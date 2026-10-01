import { getGarminTokens, saveGarminTokens } from '@/lib/garminTokens';

const ROOT_DIR = process.cwd();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

const DI_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const CONNECT_API_BASE = 'https://connectapi.garmin.com';

const RUNNING_TYPES = new Set([
  'running',
  'treadmill_running',
  'track_running',
  'trail_running',
  'street_running',
  'obstacle_run',
]);

function nativeHeaders(extra = {}) {
  return {
    'User-Agent': 'GCM-Android-5.23',
    'X-Garmin-User-Agent':
      'com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0',
    'X-Garmin-Paired-App-Version': '10861',
    'X-Garmin-Client-Platform': 'Android',
    'X-App-Ver': '10861',
    'X-Lang': 'en',
    'X-GCExperience': 'GC5',
    'Accept-Language': 'en-US,en;q=0.9',
    ...extra,
  };
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(pad, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function tokenExpiresSoon(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  return Date.now() / 1000 > payload.exp - 900;
}

async function refreshDiToken(diRefreshToken, diClientId) {
  const basicAuth = Buffer.from(`${diClientId}:`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: diClientId,
    refresh_token: diRefreshToken,
  });

  const res = await fetch(DI_TOKEN_URL, {
    method: 'POST',
    headers: nativeHeaders({
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    }),
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.access_token;
}

function fmtDuration(seconds) {
  if (seconds == null || isNaN(Number(seconds)) || Number(seconds) <= 0) return '00:00';
  const s = Math.round(Number(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
}

function speedToPace(speedMs) {
  if (!speedMs || Number(speedMs) <= 0) return '--';
  const paceSec = 1000.0 / Number(speedMs);
  let m = Math.floor(paceSec / 60);
  let s = Math.round(paceSec % 60);
  if (s >= 60) {
    m += 1;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function speedToKph(speedMs) {
  if (!speedMs || Number(speedMs) <= 0) return null;
  return Math.round(Number(speedMs) * 3.6 * 100) / 100;
}

function fahrenheitToCelsius(fTemp) {
  if (fTemp == null || isNaN(Number(fTemp))) return null;
  return Math.round(((Number(fTemp) - 32) * 5) / 9 * 10) / 10;
}

function detectPartType(title, idx, total) {
  const t = (title || '').toLowerCase().trim();
  if (t.includes('wu') || t.includes('warm')) return 'WU (Warm Up)';
  if (t.includes('cd') || t.includes('cool')) return 'CD (Cool Down)';
  if (
    t.includes('interval') ||
    t.includes('tempo') ||
    t.includes('repeat') ||
    t.includes('main') ||
    t.includes('speed') ||
    t.includes('fast')
  ) {
    return 'Main Set';
  }
  if (total === 3) {
    if (idx === 1) return 'WU (Warm Up)';
    if (idx === 2) return 'Main Set';
    if (idx === 3) return 'CD (Cool Down)';
  }
  return `Part ${idx}`;
}


function buildCsvSummary(summary, activityName, startTime, activityType, partLabel = null) {
  const cols = [
    'Part', 'Activity Type', 'Date', 'Title', 'Distance (km)', 'Duration',
    'Moving Duration', 'Elapsed Duration', 'Avg Pace (min/km)', 'Best Pace (min/km)',
    'Avg Speed (km/h)', 'Max Speed (km/h)', 'Avg HR (bpm)', 'Max HR (bpm)',
    'Avg Cadence (spm)', 'Max Cadence (spm)', 'Calories (kcal)', 'Elevation Gain (m)',
    'Elevation Loss (m)', 'Min Elevation (m)', 'Max Elevation (m)',
    'Avg Stride Length (m)', 'Avg Ground Contact Time (ms)', 'Avg Vertical Oscillation (cm)',
    'Avg Vertical Ratio (%)', 'Aerobic TE', 'Anaerobic TE', 'TE Label',
    'Body Battery Drain', 'Steps',
  ];
  const vals = [
    `"${partLabel || 'Session'}"`,
    `"${activityType}"`,
    `"${startTime}"`,
    `"${activityName}"`,
    String(summary.distance_km ?? ''),
    `"${summary.duration_formatted ?? ''}"`,
    `"${summary.moving_duration_formatted ?? ''}"`,
    `"${summary.elapsed_duration_formatted ?? ''}"`,
    `"${summary.avg_pace ?? ''}"`,
    `"${summary.best_pace ?? ''}"`,
    String(summary.avg_speed_kph ?? ''),
    String(summary.max_speed_kph ?? ''),
    String(summary.avg_hr ?? ''),
    String(summary.max_hr ?? ''),
    String(summary.avg_cadence ?? ''),
    String(summary.max_cadence ?? ''),
    String(summary.calories ?? ''),
    String(summary.elevation_gain_m ?? ''),
    String(summary.elevation_loss_m ?? ''),
    String(summary.min_elevation_m ?? ''),
    String(summary.max_elevation_m ?? ''),
    String(summary.avg_stride_length_m ?? ''),
    String(summary.avg_ground_contact_time_ms ?? ''),
    String(summary.avg_vertical_oscillation_cm ?? ''),
    String(summary.avg_vertical_ratio_percent ?? ''),
    String(summary.aerobic_training_effect ?? ''),
    String(summary.anaerobic_training_effect ?? ''),
    `"${summary.training_effect_label ?? ''}"`,
    String(summary.body_battery_drain ?? ''),
    String(summary.steps ?? ''),
  ];
  return `${cols.join(',')}\n${vals.join(',')}`;
}

function buildCsvLaps(laps) {
  if (!laps || laps.length === 0) return '';
  const cols = [
    'Part', 'Lap', 'Distance (km)', 'Duration', 'Moving Duration', 'Avg Pace (min/km)',
    'Avg Speed (km/h)', 'Avg HR (bpm)', 'Max HR (bpm)', 'Avg Cadence (spm)',
    'Max Cadence (spm)', 'Elevation Gain (m)', 'Elevation Loss (m)',
    'Avg Stride Length (m)', 'Avg GCT (ms)', 'Avg Vertical Oscillation (cm)',
    'Avg Vertical Ratio (%)', 'Calories (kcal)',
  ];
  const lines = [cols.join(',')];
  for (const l of laps) {
    const partTag = l.part_name || l.part_label || 'Lap';
    const row = [
      `"${partTag}"`,
      String(l.lap_index ?? ''),
      String(l.distance_km ?? ''),
      `"${l.duration_formatted ?? ''}"`,
      `"${l.moving_duration_formatted ?? ''}"`,
      `"${l.avg_pace ?? ''}"`,
      String(l.avg_speed_kph ?? ''),
      String(l.avg_hr ?? ''),
      String(l.max_hr ?? ''),
      String(l.avg_cadence ?? ''),
      String(l.max_cadence ?? ''),
      String(l.elevation_gain_m ?? ''),
      String(l.elevation_loss_m ?? ''),
      String(l.avg_stride_length_m ?? ''),
      String(l.avg_ground_contact_time_ms ?? ''),
      String(l.avg_vertical_oscillation_cm ?? ''),
      String(l.avg_vertical_ratio_percent ?? ''),
      String(l.calories ?? ''),
    ];
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

/**
 * Process a single Garmin Activity item into complete clean data object
 */
async function processSingleActivity(headers, actItem, partIdx = 1, totalParts = 1) {
  const actId = actItem.activityId;
  const actName = actItem.activityName || 'Running Activity';
  const partType = detectPartType(actName, partIdx, totalParts);

  const [actServiceData, splitsData, hrZonesData, weatherData, gearData] = await Promise.all([
    fetch(`${CONNECT_API_BASE}/activity-service/activity/${actId}`, { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})),
    fetch(`${CONNECT_API_BASE}/activity-service/activity/${actId}/splits`, { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})),
    fetch(`${CONNECT_API_BASE}/activity-service/activity/${actId}/hrTimeInZones`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${CONNECT_API_BASE}/activity-service/activity/${actId}/weather`, { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})),
    fetch(`${CONNECT_API_BASE}/gear-service/gear/filterGear?activityId=${actId}`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ]);

  const summaryDTO = actServiceData.summaryDTO || {};
  const metadataDTO = actServiceData.metadataDTO || {};
  const actTypeDTO = actServiceData.activityTypeDTO || actItem.activityType || {};

  const distM = summaryDTO.distance || actItem.distance || 0.0;
  const distKm = Math.round((distM / 1000.0) * 100) / 100;
  const durSec = Math.round(summaryDTO.duration || actItem.duration || 0.0);
  const movSec = Math.round(summaryDTO.movingDuration || actItem.movingDuration || durSec);
  const elpSec = Math.round(summaryDTO.elapsedDuration || actItem.elapsedDuration || durSec);

  const avgSpd = summaryDTO.averageSpeed || actItem.averageSpeed;
  const maxSpd = summaryDTO.maxSpeed || actItem.maxSpeed;

  const avgHr = summaryDTO.averageHR || actItem.averageHR ? Math.round(summaryDTO.averageHR || actItem.averageHR) : null;
  const maxHr = summaryDTO.maxHR || actItem.maxHR ? Math.round(summaryDTO.maxHR || actItem.maxHR) : null;
  const minHr = summaryDTO.minHR || actItem.minHR ? Math.round(summaryDTO.minHR || actItem.minHR) : null;

  const avgCad = summaryDTO.averageRunCadence || actItem.averageRunningCadenceInStepsPerMinute
    ? Math.round(summaryDTO.averageRunCadence || actItem.averageRunningCadenceInStepsPerMinute)
    : null;
  const maxCad = summaryDTO.maxRunCadence || actItem.maxRunningCadenceInStepsPerMinute
    ? Math.round(summaryDTO.maxRunCadence || actItem.maxRunningCadenceInStepsPerMinute)
    : null;

  let strideLen = summaryDTO.strideLength || actItem.avgStrideLength;
  if (strideLen != null) {
    const num = Number(strideLen);
    strideLen = num > 10 ? Math.round((num / 100.0) * 100) / 100 : Math.round(num * 100) / 100;
  }

  const gct = summaryDTO.groundContactTime || actItem.avgGroundContactTime
    ? Math.round(summaryDTO.groundContactTime || actItem.avgGroundContactTime)
    : null;

  let vertOsc = summaryDTO.verticalOscillation || actItem.avgVerticalOscillation;
  if (vertOsc != null) {
    const num = Number(vertOsc);
    vertOsc = num > 100 ? Math.round((num / 10.0) * 10) / 10 : Math.round(num * 10) / 10;
  }

  const vertRatio = summaryDTO.verticalRatio || actItem.avgVerticalRatio
    ? Math.round(Number(summaryDTO.verticalRatio || actItem.avgVerticalRatio) * 10) / 10
    : null;

  const elevGain = summaryDTO.elevationGain != null ? Math.round(summaryDTO.elevationGain) : (actItem.elevationGain != null ? Math.round(actItem.elevationGain) : 0);
  const elevLoss = summaryDTO.elevationLoss != null ? Math.round(summaryDTO.elevationLoss) : (actItem.elevationLoss != null ? Math.round(actItem.elevationLoss) : 0);
  const minElev = summaryDTO.minElevation != null ? Math.round(summaryDTO.minElevation * 10) / 10 : (actItem.minElevation != null ? Math.round(actItem.minElevation * 10) / 10 : null);
  const maxElev = summaryDTO.maxElevation != null ? Math.round(summaryDTO.maxElevation * 10) / 10 : (actItem.maxElevation != null ? Math.round(actItem.maxElevation * 10) / 10 : null);

  const calories = summaryDTO.calories || actItem.calories ? Math.round(summaryDTO.calories || actItem.calories) : null;
  let bbDrain = summaryDTO.differenceBodyBattery || actItem.bodyBatteryDrainedDuringActivity;
  if (bbDrain != null) bbDrain = Math.abs(Math.round(bbDrain));

  const steps = summaryDTO.steps || actItem.steps ? Math.round(summaryDTO.steps || actItem.steps) : null;
  const aerobicTe = metadataDTO.trainingEffect || actItem.aerobicTrainingEffect || null;
  const anaerobicTe = metadataDTO.anaerobicTrainingEffect || actItem.anaerobicTrainingEffect || null;
  const teLabel = summaryDTO.trainingEffectLabel || metadataDTO.trainingEffectLabel || null;

  const startTimeLocal = actServiceData.summaryDTO?.startTimeLocal || actItem.startTimeLocal || '';
  const startTimeGmt = actServiceData.summaryDTO?.startTimeGMT || actItem.startTimeGMT || '';
  const actTypeName = actTypeDTO.typeKey || 'running';

  const summaryClean = {
    distance_km: distKm,
    distance_meters: distM,
    duration_seconds: durSec,
    duration_formatted: fmtDuration(durSec),
    moving_duration_seconds: movSec,
    moving_duration_formatted: fmtDuration(movSec),
    elapsed_duration_seconds: elpSec,
    elapsed_duration_formatted: fmtDuration(elpSec),
    avg_pace: speedToPace(avgSpd),
    best_pace: speedToPace(maxSpd),
    avg_speed_kph: speedToKph(avgSpd),
    max_speed_kph: speedToKph(maxSpd),
    avg_hr: avgHr,
    max_hr: maxHr,
    min_hr: minHr,
    avg_cadence: avgCad,
    max_cadence: maxCad,
    avg_stride_length_m: strideLen,
    avg_ground_contact_time_ms: gct,
    avg_vertical_oscillation_cm: vertOsc,
    avg_vertical_ratio_percent: vertRatio,
    elevation_gain_m: elevGain,
    elevation_loss_m: elevLoss,
    min_elevation_m: minElev,
    max_elevation_m: maxElev,
    calories: calories,
    body_battery_drain: bbDrain,
    steps: steps,
    aerobic_training_effect: aerobicTe,
    anaerobic_training_effect: anaerobicTe,
    training_effect_label: teLabel,
  };

  // Laps
  const rawLaps = splitsData.lapDTOs && splitsData.lapDTOs.length > 0 ? splitsData.lapDTOs : [];
  const lapsClean = rawLaps.map((lap, lIdx) => {
    const lDistM = lap.distance || 0;
    const lDur = Math.round(lap.duration || 0);
    const lMov = Math.round(lap.movingDuration || lDur);
    const lSpd = lap.averageSpeed;
    let lStride = lap.strideLength;
    if (lStride != null) {
      const num = Number(lStride);
      lStride = num > 10 ? Math.round((num / 100.0) * 100) / 100 : Math.round(num * 100) / 100;
    }
    let lVert = lap.verticalOscillation;
    if (lVert != null) {
      const num = Number(lVert);
      lVert = num > 100 ? Math.round((num / 10.0) * 10) / 10 : Math.round(num * 10) / 10;
    }

    return {
      part_index: partIdx,
      part_name: actName,
      part_label: partType,
      lap_index: lap.lapIndex != null ? lap.lapIndex : lIdx + 1,
      distance_km: Math.round((lDistM / 1000.0) * 100) / 100,
      distance_meters: lDistM,
      duration_seconds: lDur,
      duration_formatted: fmtDuration(lDur),
      moving_duration_seconds: lMov,
      moving_duration_formatted: fmtDuration(lMov),
      avg_pace: speedToPace(lSpd),
      avg_speed_kph: speedToKph(lSpd),
      avg_hr: lap.averageHR ? Math.round(lap.averageHR) : null,
      max_hr: lap.maxHR ? Math.round(lap.maxHR) : null,
      avg_cadence: lap.averageRunCadence ? Math.round(lap.averageRunCadence) : null,
      max_cadence: lap.maxRunCadence ? Math.round(lap.maxRunCadence) : null,
      elevation_gain_m: lap.elevationGain != null ? Math.round(lap.elevationGain) : 0,
      elevation_loss_m: lap.elevationLoss != null ? Math.round(lap.elevationLoss) : 0,
      avg_stride_length_m: lStride,
      avg_ground_contact_time_ms: lap.groundContactTime ? Math.round(lap.groundContactTime) : null,
      avg_vertical_oscillation_cm: lVert,
      avg_vertical_ratio_percent: lap.verticalRatio ? Math.round(Number(lap.verticalRatio) * 10) / 10 : null,
      calories: lap.calories ? Math.round(lap.calories) : null,
    };
  });

  // HR Zones
  const rawHrZones = Array.isArray(hrZonesData) ? hrZonesData : [];
  const totZoneSecs = rawHrZones.reduce((acc, z) => acc + (z.secsInZone || 0), 0);
  const zoneNames = {
    1: 'Warm Up (Zone 1)',
    2: 'Easy / Fat Burn (Zone 2)',
    3: 'Aerobic (Zone 3)',
    4: 'Threshold (Zone 4)',
    5: 'Maximum (Zone 5)',
  };

  const hrZonesClean = [...rawHrZones]
    .sort((a, b) => (a.zoneNumber || 0) - (b.zoneNumber || 0))
    .map((z) => {
      const zNum = z.zoneNumber || 0;
      const secs = Math.round((z.secsInZone || 0) * 10) / 10;
      const pct = totZoneSecs > 0 ? Math.round((secs / totZoneSecs) * 1000) / 10 : 0;
      return {
        zone_number: zNum,
        zone_name: zoneNames[zNum] || `Zone ${zNum}`,
        min_bpm: z.zoneLowBoundary || null,
        seconds_in_zone: secs,
        duration_formatted: fmtDuration(secs),
        percentage: pct,
      };
    });

  // Weather
  let weatherClean = null;
  if (weatherData && (weatherData.temp != null || weatherData.weatherTypeDTO)) {
    weatherClean = {
      temperature_c: fahrenheitToCelsius(weatherData.temp),
      apparent_temperature_c: fahrenheitToCelsius(weatherData.apparentTemp),
      relative_humidity_percent: weatherData.relativeHumidity,
      wind_speed_kph: weatherData.windSpeed != null ? Math.round(weatherData.windSpeed * 1.60934 * 10) / 10 : null,
      wind_direction_compass: (weatherData.windDirectionCompassPoint || '').toUpperCase(),
      condition: weatherData.weatherTypeDTO?.desc || 'Fair',
      weather_issue_time: weatherData.issueDate || null,
    };
  }

  // Gear
  const gearClean = Array.isArray(gearData)
    ? gearData.map((g) => ({
        gear_name: g.customMakeModel || g.displayName || g.gearPk,
        brand: g.makeName || null,
        model: g.modelName || null,
        gear_type: g.gearTypeName || 'Shoes',
        total_distance_km: g.totalDistance ? Math.round((g.totalDistance / 1000.0) * 10) / 10 : null,
      }))
    : [];

  const csvSummaryStr = buildCsvSummary(summaryClean, actName, startTimeLocal, actTypeName, partType);
  const csvLapsStr = buildCsvLaps(lapsClean);
  const combinedCsv = `# GARMIN ACTIVITY SUMMARY - ${partType}\n${csvSummaryStr}\n\n# LAPS / SPLITS BREAKDOWN\n${csvLapsStr}`;

  return {
    part_index: partIdx,
    part_type: partType,
    activity_id: actId,
    activity_name: actName,
    activity_type: actTypeName,
    start_time_local: startTimeLocal,
    start_time_gmt: startTimeGmt,
    location_name: actServiceData.locationName || actItem.locationName || null,
    garmin_connect_url: `https://connect.garmin.com/modern/activity/${actId}`,
    summary: summaryClean,
    laps: lapsClean,
    hr_zones: hrZonesClean,
    weather: weatherClean,
    gear: gearClean,
    csv_exports: {
      summary_csv: csvSummaryStr,
      laps_csv: csvLapsStr,
      combined_csv: combinedCsv,
    },
  };
}

/**
 * Fetch list of all available workout dates (from both `activities` and `activity_details`)
 * marking each date with `in_db: true/false`
 */
async function getAvailableSessionsList() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];

  try {
    const savedDatesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/activity_details?select=session_date`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const savedDateRows = savedDatesRes.ok ? await savedDatesRes.json() : [];
    const savedDateSet = new Set(
      (savedDateRows || [])
        .map((r) => (r.session_date || '').slice(0, 10))
        .filter(Boolean)
    );

    const allActsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/activities?select=id,date,distance,title&order=date.desc&limit=150`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const allActs = allActsRes.ok ? await allActsRes.json() : [];

    const byDate = {};
    for (const a of allActs || []) {
      const dt = (a.date || '').slice(0, 10);
      if (dt) {
        byDate[dt] = byDate[dt] || [];
        byDate[dt].push(a);
      }
    }

    for (const dt of savedDateSet) {
      if (!byDate[dt]) {
        byDate[dt] = [{ distance: 0, title: 'Running Session' }];
      }
    }

    const availableSessions = Object.keys(byDate)
      .sort()
      .reverse()
      .slice(0, 40)
      .map((dt) => {
        const dayItems = byDate[dt];
        const count = dayItems.length;
        const totKm = Math.round(dayItems.reduce((acc, x) => acc + (parseFloat(x.distance) || 0), 0) * 100) / 100;
        const isSaved = savedDateSet.has(dt);
        const label = `${dt}: ${totKm > 0 ? `${totKm} km` : 'Session'} (${count} ${count > 1 ? 'runs' : 'run'}) ${isSaved ? '[In DB]' : '[Garmin]'}`;
        return {
          date: dt,
          label,
          runs_count: count,
          total_km: totKm,
          in_db: isSaved,
        };
      });

    return availableSessions;
  } catch (e) {
    console.error('Error fetching available sessions list:', e);
    return [];
  }
}

/**
 * Fetch and construct run session data directly from Supabase Database `activity_details` table
 */
async function getSessionFromSupabase(targetDate = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  try {
    const availableSessions = await getAvailableSessionsList();

    let finalDate = targetDate;
    if (!finalDate) {
      const latestSaved = availableSessions.find((s) => s.in_db);
      if (latestSaved) {
        finalDate = latestSaved.date;
      } else if (availableSessions.length > 0) {
        finalDate = availableSessions[0].date;
      }
    }

    if (!finalDate) return null;

    const detailsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/activity_details?session_date=eq.${finalDate}&order=created_at.asc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    let detailsRows = [];
    if (detailsRes.ok) {
      detailsRows = await detailsRes.json();
    }

    if (!detailsRows || detailsRows.length === 0) {
      return null;
    }

    const parts = detailsRows
      .map((r) => r.details)
      .filter(Boolean)
      .sort((a, b) => (a.start_time_local || '').localeCompare(b.start_time_local || ''));

    if (parts.length === 0) return null;

    if (parts.length === 1) {
      return {
        status: 'success',
        ...parts[0],
        is_multi_session: false,
        session_date: finalDate,
        session_activities_count: 1,
        parts,
        available_sessions: availableSessions,
        source: 'supabase_activity_details',
      };
    }

    // Multiple activities (WU + Main + CD)
    const totDistKm = Math.round(parts.reduce((sum, p) => sum + (p.summary?.distance_km || 0), 0) * 100) / 100;
    const totDistM = Math.round(parts.reduce((sum, p) => sum + (p.summary?.distance_meters || (p.summary?.distance_km || 0) * 1000), 0));
    const totDurationSecs = parts.reduce((sum, p) => sum + (p.summary?.duration_seconds || 0), 0);
    const totMovingSecs = parts.reduce((sum, p) => sum + (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
    const totElapsedSecs = parts.reduce((sum, p) => sum + (p.summary?.elapsed_duration_seconds || p.summary?.duration_seconds || 0), 0);
    const totCalories = parts.reduce((sum, p) => sum + (p.summary?.calories || 0), 0);
    const totSteps = parts.reduce((sum, p) => sum + (p.summary?.steps || 0), 0);
    const totElevGain = parts.reduce((sum, p) => sum + (p.summary?.elevation_gain_m || 0), 0);
    const totElevLoss = parts.reduce((sum, p) => sum + (p.summary?.elevation_loss_m || 0), 0);

    const avgSpd = totMovingSecs > 0 ? totDistM / totMovingSecs : 0;
    const maxSpdAll = Math.max(...parts.map((p) => (p.summary?.max_speed_kph ? p.summary.max_speed_kph / 3.6 : 0)), 0);

    const hrWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_hr || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
    const avgHr = totMovingSecs > 0 ? Math.round(hrWeightSum / totMovingSecs) : null;
    const maxHr = Math.max(...parts.map((p) => p.summary?.max_hr || 0).filter(Boolean), 0) || null;

    const cadWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_cadence || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
    const avgCadence = totMovingSecs > 0 ? Math.round(cadWeightSum / totMovingSecs) : null;
    const maxCadence = Math.max(...parts.map((p) => p.summary?.max_cadence || 0).filter(Boolean), 0) || null;

    const strideWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_stride_length_m || 0) * (p.summary?.distance_meters || (p.summary?.distance_km || 0) * 1000), 0);
    const avgStride = totDistM > 0 ? Math.round((strideWeightSum / totDistM) * 100) / 100 : null;

    const gctWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_ground_contact_time_ms || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
    const avgGct = totMovingSecs > 0 ? Math.round(gctWeightSum / totMovingSecs) : null;

    const vertWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_vertical_oscillation_cm || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
    const avgVert = totMovingSecs > 0 ? Math.round((vertWeightSum / totMovingSecs) * 10) / 10 : null;

    const vrWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_vertical_ratio_percent || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
    const avgVr = totMovingSecs > 0 ? Math.round((vrWeightSum / totMovingSecs) * 10) / 10 : null;

    const combinedLaps = [];
    let lapSeq = 1;
    for (const p of parts) {
      for (const l of p.laps || []) {
        combinedLaps.push({
          ...l,
          session_lap_index: lapSeq++,
        });
      }
    }

    const zoneSeconds = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const zoneMinMap = {};
    for (const p of parts) {
      for (const z of p.hr_zones || []) {
        const zn = z.zone_number;
        zoneSeconds[zn] = (zoneSeconds[zn] || 0) + (z.seconds_in_zone || 0);
        if (z.min_bpm && (!zoneMinMap[zn] || z.min_bpm < zoneMinMap[zn])) {
          zoneMinMap[zn] = z.min_bpm;
        }
      }
    }
    const totZoneSecs = Object.values(zoneSeconds).reduce((a, b) => a + b, 0);
    const zoneNames = {
      1: 'Warm Up (Zone 1)',
      2: 'Easy / Fat Burn (Zone 2)',
      3: 'Aerobic (Zone 3)',
      4: 'Threshold (Zone 4)',
      5: 'Maximum (Zone 5)',
    };
    const combinedHrZones = [1, 2, 3, 4, 5].map((zn) => {
      const sec = Math.round((zoneSeconds[zn] || 0) * 10) / 10;
      return {
        zone_number: zn,
        zone_name: zoneNames[zn],
        min_bpm: zoneMinMap[zn] || null,
        seconds_in_zone: sec,
        duration_formatted: fmtDuration(sec),
        percentage: totZoneSecs > 0 ? Math.round((sec / totZoneSecs) * 1000) / 10 : 0,
      };
    });

    const sessionTitle = `${finalDate} Interval Session (${parts.map((p) => p.activity_name || p.part_type).join(' + ')})`;

    const combinedSummary = {
      distance_km: totDistKm,
      distance_meters: totDistM,
      duration_seconds: totDurationSecs,
      duration_formatted: fmtDuration(totDurationSecs),
      moving_duration_seconds: totMovingSecs,
      moving_duration_formatted: fmtDuration(totMovingSecs),
      elapsed_duration_seconds: totElapsedSecs,
      elapsed_duration_formatted: fmtDuration(totElapsedSecs),
      avg_pace: speedToPace(avgSpd),
      best_pace: speedToPace(maxSpdAll),
      avg_speed_kph: speedToKph(avgSpd),
      max_speed_kph: speedToKph(maxSpdAll),
      avg_hr: avgHr,
      max_hr: maxHr,
      avg_cadence: avgCadence,
      max_cadence: maxCadence,
      avg_stride_length_m: avgStride,
      avg_ground_contact_time_ms: avgGct,
      avg_vertical_oscillation_cm: avgVert,
      avg_vertical_ratio_percent: avgVr,
      elevation_gain_m: totElevGain,
      elevation_loss_m: totElevLoss,
      min_elevation_m: Math.min(...parts.map((p) => p.summary?.min_elevation_m).filter((v) => v != null), 0) || null,
      max_elevation_m: Math.max(...parts.map((p) => p.summary?.max_elevation_m).filter((v) => v != null), 0) || null,
      calories: totCalories || null,
      body_battery_drain: parts.reduce((s, p) => s + (p.summary?.body_battery_drain || 0), 0) || null,
      steps: totSteps || null,
      aerobic_training_effect: Math.max(...parts.map((p) => p.summary?.aerobic_training_effect || 0).filter(Boolean), 0) || null,
      anaerobic_training_effect: Math.max(...parts.map((p) => p.summary?.anaerobic_training_effect || 0).filter(Boolean), 0) || null,
      training_effect_label: 'INTERVAL / MULTI-SESSION',
    };

    const csvSummaryRows = [];
    const summaryCols = [
      'Part', 'Activity Type', 'Date', 'Title', 'Distance (km)', 'Duration',
      'Moving Duration', 'Elapsed Duration', 'Avg Pace (min/km)', 'Best Pace (min/km)',
      'Avg Speed (km/h)', 'Max Speed (km/h)', 'Avg HR (bpm)', 'Max HR (bpm)',
      'Avg Cadence (spm)', 'Max Cadence (spm)', 'Calories (kcal)', 'Elevation Gain (m)',
      'Elevation Loss (m)', 'Min Elevation (m)', 'Max Elevation (m)',
      'Avg Stride Length (m)', 'Avg Ground Contact Time (ms)', 'Avg Vertical Oscillation (cm)',
      'Avg Vertical Ratio (%)', 'Aerobic TE', 'Anaerobic TE', 'TE Label',
      'Body Battery Drain', 'Steps',
    ];
    csvSummaryRows.push(summaryCols.join(','));
    for (const p of parts) {
      const s = p.summary || {};
      const row = [
        `"${p.part_type}"`,
        `"${p.activity_type}"`,
        `"${p.start_time_local}"`,
        `"${p.activity_name}"`,
        String(s.distance_km ?? ''),
        `"${s.duration_formatted ?? ''}"`,
        `"${s.moving_duration_formatted ?? ''}"`,
        `"${s.elapsed_duration_formatted ?? ''}"`,
        `"${s.avg_pace ?? ''}"`,
        `"${s.best_pace ?? ''}"`,
        String(s.avg_speed_kph ?? ''),
        String(s.max_speed_kph ?? ''),
        String(s.avg_hr ?? ''),
        String(s.max_hr ?? ''),
        String(s.avg_cadence ?? ''),
        String(s.max_cadence ?? ''),
        String(s.calories ?? ''),
        String(s.elevation_gain_m ?? ''),
        String(s.elevation_loss_m ?? ''),
        String(s.min_elevation_m ?? ''),
        String(s.max_elevation_m ?? ''),
        String(s.avg_stride_length_m ?? ''),
        String(s.avg_ground_contact_time_ms ?? ''),
        String(s.avg_vertical_oscillation_cm ?? ''),
        String(s.avg_vertical_ratio_percent ?? ''),
        String(s.aerobic_training_effect ?? ''),
        String(s.anaerobic_training_effect ?? ''),
        `"${s.training_effect_label ?? ''}"`,
        String(s.body_battery_drain ?? ''),
        String(s.steps ?? ''),
      ];
      csvSummaryRows.push(row.join(','));
    }

    const cs = combinedSummary;
    const totRow = [
      '"TOTAL SESSION"',
      '"running"',
      `"${parts[0].start_time_local}"`,
      `"${sessionTitle}"`,
      String(cs.distance_km ?? ''),
      `"${cs.duration_formatted ?? ''}"`,
      `"${cs.moving_duration_formatted ?? ''}"`,
      `"${cs.elapsed_duration_formatted ?? ''}"`,
      `"${cs.avg_pace ?? ''}"`,
      `"${cs.best_pace ?? ''}"`,
      String(cs.avg_speed_kph ?? ''),
      String(cs.max_speed_kph ?? ''),
      String(cs.avg_hr ?? ''),
      String(cs.max_hr ?? ''),
      String(cs.avg_cadence ?? ''),
      String(cs.max_cadence ?? ''),
      String(cs.calories ?? ''),
      String(cs.elevation_gain_m ?? ''),
      String(cs.elevation_loss_m ?? ''),
      String(cs.min_elevation_m ?? ''),
      String(cs.max_elevation_m ?? ''),
      String(cs.avg_stride_length_m ?? ''),
      String(cs.avg_ground_contact_time_ms ?? ''),
      String(cs.avg_vertical_oscillation_cm ?? ''),
      String(cs.avg_vertical_ratio_percent ?? ''),
      String(cs.aerobic_training_effect ?? ''),
      String(cs.anaerobic_training_effect ?? ''),
      `"${cs.training_effect_label ?? ''}"`,
      String(cs.body_battery_drain ?? ''),
      String(cs.steps ?? ''),
    ];
    csvSummaryRows.push(totRow.join(','));
    const combinedSummaryCsv = csvSummaryRows.join('\n');
    const combinedLapsCsv = buildCsvLaps(combinedLaps);
    const fullCombinedCsv = `# GARMIN WORKOUT SESSION SUMMARY (${finalDate})\n${combinedSummaryCsv}\n\n# ALL LAPS / SPLITS BREAKDOWN (WU + MAIN + CD)\n${combinedLapsCsv}`;

    return {
      status: 'success',
      is_multi_session: true,
      session_date: finalDate,
      session_activities_count: parts.length,
      activity_id: parts[0].activity_id,
      activity_name: sessionTitle,
      activity_type: 'running',
      start_time_local: parts[0].start_time_local,
      start_time_gmt: parts[0].start_time_gmt,
      location_name: parts[0].location_name,
      garmin_connect_url: parts[0].garmin_connect_url,
      summary: combinedSummary,
      parts,
      laps: combinedLaps,
      hr_zones: combinedHrZones,
      weather: parts[0].weather,
      gear: parts[0].gear,
      available_sessions: availableSessions,
      csv_exports: {
        combined_csv: fullCombinedCsv,
        summary_csv: parts.map((p) => p.csv_exports?.summary_csv || '').join('\n'),
        laps_csv: parts.map((p) => p.csv_exports?.laps_csv || '').join('\n'),
      },
      source: 'supabase_activity_details',
    };
  } catch (e) {
    console.error('Error fetching session from Supabase activity_details:', e);
    return null;
  }
}

/**
 * Persist activity details into Supabase Database `activity_details` table
 */
async function persistToSupabase(data) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !data) return;

  try {
    const partsToSave = data.parts && data.parts.length > 0 ? data.parts : [data];

    for (const p of partsToSave) {
      const actId = p.activity_id;
      if (!actId) continue;

      const sessionDate = data.session_date || p.start_time_local?.slice(0, 10);
      const payload = {
        activity_id: String(actId),
        session_date: sessionDate,
        details: p,
        updated_at: new Date().toISOString(),
      };

      await fetch(`${SUPABASE_URL}/rest/v1/activity_details`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      });
    }
  } catch (e) {
    console.error('Error persisting activity details to Supabase activity_details:', e);
  }
}

/**
 * Pure Node.js Garmin Details Fetcher
 */
async function fetchGarminDetailsNode(targetDate = null) {
  const tokens = await getGarminTokens();
  if (!tokens || !tokens.di_token) {
    throw new Error('No Garmin tokens found. Please authenticate via the Garmin Login page.');
  }

  let diToken = tokens.di_token;
  if (tokenExpiresSoon(diToken)) {
    if (tokens.di_refresh_token && tokens.di_client_id) {
      diToken = await refreshDiToken(tokens.di_refresh_token, tokens.di_client_id);
      saveGarminTokens({ ...tokens, di_token: diToken }).catch(() => {});
    }
  }

  const headers = nativeHeaders({
    Authorization: `Bearer ${diToken}`,
    Accept: 'application/json',
  });

  let runningActs = [];
  let sessionDate = targetDate;

  if (targetDate) {
    // 1. Query for targetDate
    const url = `${CONNECT_API_BASE}/activitylist-service/activities/search/activities?startDate=${targetDate}&endDate=${targetDate}&limit=20`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const acts = await res.json();
      runningActs = (Array.isArray(acts) ? acts : []).filter((a) =>
        RUNNING_TYPES.has((a.activityType?.typeKey || '').toLowerCase())
      );
    }

    // If not found in date range search (could be due to GMT vs local time offset), search recent 50
    if (runningActs.length === 0) {
      const searchRes = await fetch(
        `${CONNECT_API_BASE}/activitylist-service/activities/search/activities?start=0&limit=50`,
        { headers }
      );
      if (searchRes.ok) {
        const searchActs = await searchRes.json();
        const allRuns = (Array.isArray(searchActs) ? searchActs : []).filter((a) =>
          RUNNING_TYPES.has((a.activityType?.typeKey || '').toLowerCase())
        );
        runningActs = allRuns.filter(
          (a) => (a.startTimeLocal || '').slice(0, 10) === targetDate || (a.startTimeGMT || '').slice(0, 10) === targetDate
        );
      }
    }
  } else {
    // No targetDate specified -> find latest running date from recent 35 activities
    const res = await fetch(
      `${CONNECT_API_BASE}/activitylist-service/activities/search/activities?start=0&limit=35`,
      { headers }
    );
    if (!res.ok) {
      throw new Error(`Garmin API error: HTTP ${res.status}`);
    }
    const acts = await res.json();
    const allRuns = (Array.isArray(acts) ? acts : []).filter((a) =>
      RUNNING_TYPES.has((a.activityType?.typeKey || '').toLowerCase())
    );
    if (allRuns.length === 0) {
      throw new Error('No running activities found in Garmin account.');
    }

    // Group runs by date
    const runsByDate = {};
    for (const a of allRuns) {
      const dt = (a.startTimeLocal || a.startTimeGMT || '').slice(0, 10);
      if (dt) {
        runsByDate[dt] = runsByDate[dt] || [];
        runsByDate[dt].push(a);
      }
    }

    sessionDate = Object.keys(runsByDate).sort().reverse()[0];
    runningActs = runsByDate[sessionDate] || [];
  }

  if (runningActs.length === 0) {
    throw new Error(`No running activities found on ${targetDate || 'the latest date'}`);
  }

  // Sort chronologically (earliest -> latest: WU -> Main -> CD)
  runningActs.sort((a, b) => (a.startTimeLocal || '').localeCompare(b.startTimeLocal || ''));

  const totalParts = runningActs.length;
  const parts = await Promise.all(
    runningActs.map((act, idx) => processSingleActivity(headers, act, idx + 1, totalParts))
  );

  const availableSessions = await getAvailableSessionsList();

  if (totalParts === 1) {
    const single = parts[0];
    const out = {
      status: 'success',
      ...single,
      is_multi_session: false,
      session_date: sessionDate,
      session_activities_count: 1,
      parts,
      available_sessions: availableSessions,
    };
    await persistToSupabase(out);
    return out;
  }

  // Multi-session combined calculations
  const totDistKm = Math.round(parts.reduce((sum, p) => sum + (p.summary?.distance_km || 0), 0) * 100) / 100;
  const totDistM = Math.round(parts.reduce((sum, p) => sum + (p.summary?.distance_meters || (p.summary?.distance_km || 0) * 1000), 0));
  const totDurationSecs = parts.reduce((sum, p) => sum + (p.summary?.duration_seconds || 0), 0);
  const totMovingSecs = parts.reduce((sum, p) => sum + (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
  const totElapsedSecs = parts.reduce((sum, p) => sum + (p.summary?.elapsed_duration_seconds || p.summary?.duration_seconds || 0), 0);
  const totCalories = parts.reduce((sum, p) => sum + (p.summary?.calories || 0), 0);
  const totSteps = parts.reduce((sum, p) => sum + (p.summary?.steps || 0), 0);
  const totElevGain = parts.reduce((sum, p) => sum + (p.summary?.elevation_gain_m || 0), 0);
  const totElevLoss = parts.reduce((sum, p) => sum + (p.summary?.elevation_loss_m || 0), 0);

  const avgSpd = totMovingSecs > 0 ? totDistM / totMovingSecs : 0;
  const maxSpdAll = Math.max(...parts.map((p) => (p.summary?.max_speed_kph ? p.summary.max_speed_kph / 3.6 : 0)), 0);

  const hrWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_hr || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
  const avgHr = totMovingSecs > 0 ? Math.round(hrWeightSum / totMovingSecs) : null;
  const maxHr = Math.max(...parts.map((p) => p.summary?.max_hr || 0).filter(Boolean), 0) || null;

  const cadWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_cadence || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
  const avgCadence = totMovingSecs > 0 ? Math.round(cadWeightSum / totMovingSecs) : null;
  const maxCadence = Math.max(...parts.map((p) => p.summary?.max_cadence || 0).filter(Boolean), 0) || null;

  const strideWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_stride_length_m || 0) * (p.summary?.distance_meters || (p.summary?.distance_km || 0) * 1000), 0);
  const avgStride = totDistM > 0 ? Math.round((strideWeightSum / totDistM) * 100) / 100 : null;

  const gctWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_ground_contact_time_ms || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
  const avgGct = totMovingSecs > 0 ? Math.round(gctWeightSum / totMovingSecs) : null;

  const vertWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_vertical_oscillation_cm || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
  const avgVert = totMovingSecs > 0 ? Math.round((vertWeightSum / totMovingSecs) * 10) / 10 : null;

  const vrWeightSum = parts.reduce((sum, p) => sum + (p.summary?.avg_vertical_ratio_percent || 0) * (p.summary?.moving_duration_seconds || p.summary?.duration_seconds || 0), 0);
  const avgVr = totMovingSecs > 0 ? Math.round((vrWeightSum / totMovingSecs) * 10) / 10 : null;

  const combinedLaps = [];
  let lapSeq = 1;
  for (const p of parts) {
    for (const l of p.laps || []) {
      combinedLaps.push({
        ...l,
        session_lap_index: lapSeq++,
      });
    }
  }

  const zoneSeconds = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const zoneMinMap = {};
  for (const p of parts) {
    for (const z of p.hr_zones || []) {
      const zn = z.zone_number;
      zoneSeconds[zn] = (zoneSeconds[zn] || 0) + (z.seconds_in_zone || 0);
      if (z.min_bpm && (!zoneMinMap[zn] || z.min_bpm < zoneMinMap[zn])) {
        zoneMinMap[zn] = z.min_bpm;
      }
    }
  }
  const totZoneSecs = Object.values(zoneSeconds).reduce((a, b) => a + b, 0);
  const zoneNames = {
    1: 'Warm Up (Zone 1)',
    2: 'Easy / Fat Burn (Zone 2)',
    3: 'Aerobic (Zone 3)',
    4: 'Threshold (Zone 4)',
    5: 'Maximum (Zone 5)',
  };
  const combinedHrZones = [1, 2, 3, 4, 5].map((zn) => {
    const sec = Math.round((zoneSeconds[zn] || 0) * 10) / 10;
    return {
      zone_number: zn,
      zone_name: zoneNames[zn],
      min_bpm: zoneMinMap[zn] || null,
      seconds_in_zone: sec,
      duration_formatted: fmtDuration(sec),
      percentage: totZoneSecs > 0 ? Math.round((sec / totZoneSecs) * 1000) / 10 : 0,
    };
  });

  const sessionTitle = `${sessionDate} Interval Session (${parts.map((p) => p.activity_name || p.part_type).join(' + ')})`;

  const combinedSummary = {
    distance_km: totDistKm,
    distance_meters: totDistM,
    duration_seconds: totDurationSecs,
    duration_formatted: fmtDuration(totDurationSecs),
    moving_duration_seconds: totMovingSecs,
    moving_duration_formatted: fmtDuration(totMovingSecs),
    elapsed_duration_seconds: totElapsedSecs,
    elapsed_duration_formatted: fmtDuration(totElapsedSecs),
    avg_pace: speedToPace(avgSpd),
    best_pace: speedToPace(maxSpdAll),
    avg_speed_kph: speedToKph(avgSpd),
    max_speed_kph: speedToKph(maxSpdAll),
    avg_hr: avgHr,
    max_hr: maxHr,
    avg_cadence: avgCadence,
    max_cadence: maxCadence,
    avg_stride_length_m: avgStride,
    avg_ground_contact_time_ms: avgGct,
    avg_vertical_oscillation_cm: avgVert,
    avg_vertical_ratio_percent: avgVr,
    elevation_gain_m: totElevGain,
    elevation_loss_m: totElevLoss,
    min_elevation_m: Math.min(...parts.map((p) => p.summary?.min_elevation_m).filter((v) => v != null), 0) || null,
    max_elevation_m: Math.max(...parts.map((p) => p.summary?.max_elevation_m).filter((v) => v != null), 0) || null,
    calories: totCalories || null,
    body_battery_drain: parts.reduce((s, p) => s + (p.summary?.body_battery_drain || 0), 0) || null,
    steps: totSteps || null,
    aerobic_training_effect: Math.max(...parts.map((p) => p.summary?.aerobic_training_effect || 0).filter(Boolean), 0) || null,
    anaerobic_training_effect: Math.max(...parts.map((p) => p.summary?.anaerobic_training_effect || 0).filter(Boolean), 0) || null,
    training_effect_label: 'INTERVAL / MULTI-SESSION',
  };

  const csvSummaryRows = [];
  const summaryCols = [
    'Part', 'Activity Type', 'Date', 'Title', 'Distance (km)', 'Duration',
    'Moving Duration', 'Elapsed Duration', 'Avg Pace (min/km)', 'Best Pace (min/km)',
    'Avg Speed (km/h)', 'Max Speed (km/h)', 'Avg HR (bpm)', 'Max HR (bpm)',
    'Avg Cadence (spm)', 'Max Cadence (spm)', 'Calories (kcal)', 'Elevation Gain (m)',
    'Elevation Loss (m)', 'Min Elevation (m)', 'Max Elevation (m)',
    'Avg Stride Length (m)', 'Avg Ground Contact Time (ms)', 'Avg Vertical Oscillation (cm)',
    'Avg Vertical Ratio (%)', 'Aerobic TE', 'Anaerobic TE', 'TE Label',
    'Body Battery Drain', 'Steps',
  ];
  csvSummaryRows.push(summaryCols.join(','));
  for (const p of parts) {
    const s = p.summary || {};
    const row = [
      `"${p.part_type}"`,
      `"${p.activity_type}"`,
      `"${p.start_time_local}"`,
      `"${p.activity_name}"`,
      String(s.distance_km ?? ''),
      `"${s.duration_formatted ?? ''}"`,
      `"${s.moving_duration_formatted ?? ''}"`,
      `"${s.elapsed_duration_formatted ?? ''}"`,
      `"${s.avg_pace ?? ''}"`,
      `"${s.best_pace ?? ''}"`,
      String(s.avg_speed_kph ?? ''),
      String(s.max_speed_kph ?? ''),
      String(s.avg_hr ?? ''),
      String(s.max_hr ?? ''),
      String(s.avg_cadence ?? ''),
      String(s.max_cadence ?? ''),
      String(s.calories ?? ''),
      String(s.elevation_gain_m ?? ''),
      String(s.elevation_loss_m ?? ''),
      String(s.min_elevation_m ?? ''),
      String(s.max_elevation_m ?? ''),
      String(s.avg_stride_length_m ?? ''),
      String(s.avg_ground_contact_time_ms ?? ''),
      String(s.avg_vertical_oscillation_cm ?? ''),
      String(s.avg_vertical_ratio_percent ?? ''),
      String(s.aerobic_training_effect ?? ''),
      String(s.anaerobic_training_effect ?? ''),
      `"${s.training_effect_label ?? ''}"`,
      String(s.body_battery_drain ?? ''),
      String(s.steps ?? ''),
    ];
    csvSummaryRows.push(row.join(','));
  }

  const cs = combinedSummary;
  const totRow = [
    '"TOTAL SESSION"',
    '"running"',
    `"${parts[0].start_time_local}"`,
    `"${sessionTitle}"`,
    String(cs.distance_km ?? ''),
    `"${cs.duration_formatted ?? ''}"`,
    `"${cs.moving_duration_formatted ?? ''}"`,
    `"${cs.elapsed_duration_formatted ?? ''}"`,
    `"${cs.avg_pace ?? ''}"`,
    `"${cs.best_pace ?? ''}"`,
    String(cs.avg_speed_kph ?? ''),
    String(cs.max_speed_kph ?? ''),
    String(cs.avg_hr ?? ''),
    String(cs.max_hr ?? ''),
    String(cs.avg_cadence ?? ''),
    String(cs.max_cadence ?? ''),
    String(cs.calories ?? ''),
    String(cs.elevation_gain_m ?? ''),
    String(cs.elevation_loss_m ?? ''),
    String(cs.min_elevation_m ?? ''),
    String(cs.max_elevation_m ?? ''),
    String(cs.avg_stride_length_m ?? ''),
    String(cs.avg_ground_contact_time_ms ?? ''),
    String(cs.avg_vertical_oscillation_cm ?? ''),
    String(cs.avg_vertical_ratio_percent ?? ''),
    String(cs.aerobic_training_effect ?? ''),
    String(cs.anaerobic_training_effect ?? ''),
    `"${cs.training_effect_label ?? ''}"`,
    String(cs.body_battery_drain ?? ''),
    String(cs.steps ?? ''),
  ];
  csvSummaryRows.push(totRow.join(','));
  const combinedSummaryCsv = csvSummaryRows.join('\n');
  const combinedLapsCsv = buildCsvLaps(combinedLaps);
  const fullCombinedCsv = `# GARMIN WORKOUT SESSION SUMMARY (${sessionDate})\n${combinedSummaryCsv}\n\n# ALL LAPS / SPLITS BREAKDOWN (WU + MAIN + CD)\n${combinedLapsCsv}`;

  const out = {
    status: 'success',
    is_multi_session: true,
    session_date: sessionDate,
    session_activities_count: totalParts,
    activity_id: parts[0].activity_id,
    activity_name: sessionTitle,
    activity_type: 'running',
    start_time_local: parts[0].start_time_local,
    start_time_gmt: parts[0].start_time_gmt,
    location_name: parts[0].location_name,
    garmin_connect_url: parts[0].garmin_connect_url,
    summary: combinedSummary,
    parts,
    laps: combinedLaps,
    hr_zones: combinedHrZones,
    weather: parts[0].weather,
    gear: parts[0].gear,
    available_sessions: availableSessions,
    csv_exports: {
      summary_csv: combinedSummaryCsv,
      laps_csv: combinedLapsCsv,
      combined_csv: fullCombinedCsv,
    },
  };

  await persistToSupabase(out);
  return out;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const forceFresh = searchParams.get('fresh') === 'true' || searchParams.get('refresh') === 'true';
  const targetDate = searchParams.get('date') || null;

  // 1. Check Supabase Database `activity_details` table first for instant (~20ms) response
  if (!forceFresh) {
    const dbSession = await getSessionFromSupabase(targetDate);
    if (dbSession) {
      return Response.json(dbSession);
    }
  }

  // 2. Fetch fresh from Garmin Connect API via pure Node.js HTTPS
  try {
    const garminData = await fetchGarminDetailsNode(targetDate);
    return Response.json(garminData);
  } catch (err) {
    console.error('Error fetching Garmin Details in Node.js:', err);

    // Fallback: check if we have any session in Supabase if live Garmin call failed
    const fallbackDb = await getSessionFromSupabase(targetDate);
    if (fallbackDb) {
      return Response.json(fallbackDb);
    }

    return Response.json(
      {
        status: 'error',
        error: err.message || `Unable to fetch running activity on ${targetDate || 'the latest date'}`,
        session_date: targetDate,
      },
      { status: 200 }
    );
  }
}

export async function POST(request) {
  let targetDate = null;
  try {
    const body = await request.json();
    targetDate = body?.date || null;
  } catch {}

  try {
    const garminData = await fetchGarminDetailsNode(targetDate);
    return Response.json(garminData);
  } catch (err) {
    console.error('Error in POST garmin-last-run:', err);
    return Response.json(
      {
        status: 'error',
        error: err.message || `Unable to fetch running activity on ${targetDate || 'the latest date'}`,
        session_date: targetDate,
      },
      { status: 200 }
    );
  }
}
