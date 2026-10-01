import { createClient } from '@supabase/supabase-js';
import { getGarminTokens, saveGarminTokens } from '@/lib/garminTokens';

const DI_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const CONNECT_API_BASE = 'https://connectapi.garmin.com';

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
    if (res.status === 400 || res.status === 401) {
      throw new Error(
        `Garmin refresh token expired or invalid (${res.status}). Please re-authenticate via the Garmin Login tab.`
      );
    }
    throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.access_token;
}

function fmtTime(seconds) {
  if (!seconds || seconds <= 0) return '--';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
  }
  return `${m}:${sc.toString().padStart(2, '0')}`;
}

function calcAge(birthDateStr) {
  if (!birthDateStr) return null;
  try {
    const bDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
      age--;
    }
    return isNaN(age) ? null : age;
  } catch {
    return null;
  }
}

const PR_MAP = {
  1: { key: '1k', label: '1K', order: 1 },
  2: { key: '1mi', label: '1 Mile', order: 2 },
  3: { key: '5k', label: '5K', order: 3 },
  4: { key: '10k', label: '10K', order: 4 },
  5: { key: 'hm', label: 'Half Marathon', order: 5 },
  6: { key: 'full', label: 'Full Marathon', order: 6 },
  7: { key: 'longest', label: 'Longest Run', order: 7 },
};

async function saveTokens(tokenData) {
  try {
    await saveGarminTokens(tokenData);
  } catch (err) {
    console.warn('[garmin-profile-sync] Could not save tokens:', err.message);
  }
}

async function fetchGarminProfileData(tokens) {
  let { di_token, di_refresh_token, di_client_id } = tokens;

  if (tokenExpiresSoon(di_token) && di_refresh_token && di_client_id) {
    try {
      di_token = await refreshDiToken(di_refresh_token, di_client_id);
      saveTokens({ ...tokens, di_token });
    } catch (e) {
      console.warn('[garmin-profile-sync] Proactive token refresh failed:', e.message);
    }
  }

  async function apiGet(endpoint, params = {}, timeoutMs = 6000) {
    let url = `${CONNECT_API_BASE}${endpoint}`;
    const search = new URLSearchParams(params).toString();
    if (search) url += `?${search}`;

    let res = null;
    try {
      res = await fetch(url, {
        headers: nativeHeaders({
          Authorization: `Bearer ${di_token}`,
          Accept: 'application/json',
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      // Timeout or network error
      return null;
    }

    if (res.status === 401 && di_refresh_token && di_client_id) {
      try {
        di_token = await refreshDiToken(di_refresh_token, di_client_id);
        saveTokens({ ...tokens, di_token });
        res = await fetch(url, {
          headers: nativeHeaders({
            Authorization: `Bearer ${di_token}`,
            Accept: 'application/json',
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        return null;
      }
    }

    if (!res || !res.ok) {
      return null;
    }
    return res.json().catch(() => null);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgoStr = weekAgoDate.toISOString().slice(0, 10);

  // 1. User Profile & Biometrics
  const profileData = (await apiGet('/userprofile-service/userprofile/user-settings')) || {};
  const userData = profileData.userData || {};
  const userNum = userData.userProfileNumber || 116707114;
  const age = calcAge(userData.birthDate);
  const heightCm = userData.height || null;
  const gender = userData.gender === 'MALE' ? 'M' : userData.gender === 'FEMALE' ? 'F' : 'M';

  // 2. VO2 Max History (60 Days for fast, reliable response)
  const sixtyDaysAgoDate = new Date();
  sixtyDaysAgoDate.setDate(sixtyDaysAgoDate.getDate() - 60);
  const sixtyDaysAgoStr = sixtyDaysAgoDate.toISOString().slice(0, 10);

  const rawMaxMet = (await apiGet(`/metrics-service/metrics/maxmet/daily/${sixtyDaysAgoStr}/${todayStr}`, {}, 6000)) || [];
  const dailyVo2Map = {};
  let latestVo2Precise = null;
  let latestVo2Date = null;

  if (Array.isArray(rawMaxMet)) {
    for (const item of rawMaxMet) {
      const cDate = item.generic?.calendarDate;
      const vVal = item.generic?.vo2MaxPreciseValue ?? item.generic?.vo2MaxValue ?? item.cycling?.vo2MaxPreciseValue;
      if (cDate && vVal) {
        const rounded1d = Math.round(vVal * 10) / 10;
        dailyVo2Map[cDate] = rounded1d;
        if (!latestVo2Date || cDate >= latestVo2Date) {
          latestVo2Date = cDate;
          latestVo2Precise = rounded1d;
        }
      }
    }
  }

  const vo2max = latestVo2Precise ?? (userData.vo2MaxRunning ? Math.round(userData.vo2MaxRunning * 10) / 10 : null);

  // 3. Social Profile for Display Name
  const socialProfile = (await apiGet('/userprofile-service/socialProfile')) || {};
  const displayName = socialProfile.displayName || '';

  // 4. Fitness Age & Resting HR History (60 Days)
  const fitData = (await apiGet(`/fitnessage-service/fitnessage/${todayStr}`)) || {};
  const fitnessAge = fitData.fitnessAge ? Math.round(fitData.fitnessAge * 10) / 10 : null;
  let rhr = fitData.components?.rhr?.value || null;

  const rawRhrData = (await apiGet(`/usersummary-service/stats/heartRate/daily/${sixtyDaysAgoStr}/${todayStr}`, {}, 6000)) || {};
  const rhrMetricsList = rawRhrData?.allMetrics?.metricsMap?.WELLNESS_RESTING_HEART_RATE || [];
  const dailyRhrMap = {};
  if (Array.isArray(rhrMetricsList)) {
    for (const item of rhrMetricsList) {
      if (item.calendarDate && item.value) {
        dailyRhrMap[item.calendarDate] = Math.round(item.value);
      }
    }
  }

  if (!rhr) {
    rhr = dailyRhrMap[todayStr] || null;
  }

  // 4. Device Info
  const devInfo = await apiGet('/device-service/deviceservice/mylastused').catch(() => ({}));
  const device = {
    name: devInfo.lastUsedDeviceName || 'Garmin Watch',
    image_url: devInfo.imageUrl || '',
    last_upload: devInfo.lastUsedDeviceUploadTime || null,
  };

  // 5. Official Personal Records (PRs)
  let rawPrs = [];
  if (displayName) {
    rawPrs = await apiGet(`/personalrecord-service/personalrecord/prs/${encodeURIComponent(displayName)}`).catch(() => []);
  }
  const prs = {};
  if (Array.isArray(rawPrs)) {
    for (const p of rawPrs) {
      const tid = p.typeId;
      if (PR_MAP[tid]) {
        const conf = PR_MAP[tid];
        const val = p.value;
        if (tid === 7) {
          const distKm = val ? Math.round((val / 1000.0) * 100) / 100 : 0;
          prs[conf.key] = {
            key: conf.key,
            label: conf.label,
            order: conf.order,
            distance_km: distKm,
            time_str: `${distKm} km`,
            activity_name: p.activityName || 'Longest Run',
            date: (p.actStartDateTimeInGMTFormatted || '').slice(0, 10),
          };
        } else {
          prs[conf.key] = {
            key: conf.key,
            label: conf.label,
            order: conf.order,
            seconds: val,
            time_str: fmtTime(val),
            activity_name: p.activityName || 'Running',
            date: (p.actStartDateTimeInGMTFormatted || '').slice(0, 10),
          };
        }
      }
    }
  }

  // 6. Gear (Running Shoes)
  const gearsRaw = await apiGet('/gear-service/gear/filterGear', { userProfilePk: userNum }).catch(() => []);
  const shoes = [];
  if (Array.isArray(gearsRaw)) {
    for (const g of gearsRaw) {
      if (g.gearTypeName === 'Shoes' || g.customMakeModel || g.displayName) {
        const uuid = g.uuid;
        let stats = {};
        if (uuid) {
          stats = await apiGet(`/gear-service/gear/stats/${uuid}`).catch(() => ({}));
        }
        const distKm = Math.round(((stats.totalDistance || 0) / 1000.0) * 10) / 10;
        const maxKm = Math.round(((g.maximumMeters || 0) / 1000.0) * 10) / 10;
        const wearPct = maxKm > 0 ? Math.round((distKm / maxKm * 100) * 10) / 10 : 0;
        shoes.push({
          uuid,
          name: g.displayName || g.customMakeModel || 'Running Shoes',
          brand_model: g.customMakeModel || g.gearModelName || '',
          distance_km: distKm,
          max_distance_km: maxKm,
          wear_pct: wearPct,
          status: g.gearStatusName || 'active',
          date_begin: (g.dateBegin || '').slice(0, 10),
        });
      }
    }
    shoes.sort((a, b) => {
      const aStat = a.status === 'active' ? 0 : 1;
      const bStat = b.status === 'active' ? 0 : 1;
      if (aStat !== bStat) return aStat - bStat;
      return b.distance_km - a.distance_km;
    });
  }

  // 7. Daily Steps (Last 7 Days)
  const rawSteps = await apiGet(`/usersummary-service/stats/steps/daily/${weekAgoStr}/${todayStr}`).catch(() => []);
  const dailySteps = [];
  if (Array.isArray(rawSteps)) {
    for (const s of rawSteps) {
      const calDate = s.calendarDate || '';
      const stepsVal = s.totalSteps || 0;
      const goalVal = s.stepGoal || 10000;
      const distM = s.totalDistance || 0;
      const distKm = Math.round((distM / 1000.0) * 100) / 100;
      const pct = goalVal > 0 ? Math.round((stepsVal / goalVal * 100) * 10) / 10 : 0;
      dailySteps.push({
        date: calDate,
        steps: stepsVal,
        goal: goalVal,
        distance_km: distKm,
        hit_goal: stepsVal >= goalVal,
        pct,
      });
    }
  }

  // 8. Body Battery Balance (Last 7 Days)
  const rawBb = await apiGet('/wellness-service/wellness/bodyBattery/reports/daily', {
    startDate: weekAgoStr,
    endDate: todayStr,
  }).catch(() => []);
  const bodyBattery = [];
  if (Array.isArray(rawBb)) {
    for (const b of rawBb) {
      const bDate = b.date || '';
      const charged = b.charged || 0;
      const drained = b.drained || 0;
      const net = charged - drained;

      let sleepImpact = 0;
      let napImpact = 0;
      for (const ev of (b.bodyBatteryActivityEvent || [])) {
        if (ev.eventType === 'SLEEP') sleepImpact = ev.bodyBatteryImpact || 0;
        else if (ev.eventType === 'NAP') napImpact = ev.bodyBatteryImpact || 0;
      }

      const feedbackEvent = b.bodyBatteryDynamicFeedbackEvent || {};
      const feedbackShort = feedbackEvent.feedbackShortType || '';
      const feedbackTitle = feedbackShort
        ? feedbackShort.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        : '';

      bodyBattery.push({
        date: bDate,
        charged,
        drained,
        net,
        sleep_impact: sleepImpact,
        nap_impact: napImpact,
        feedback: feedbackTitle,
      });
    }
  }

  // 9. Sleep Tracking Data (Last 30 Days)
  const sleepDates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    sleepDates.push(d.toISOString().slice(0, 10));
  }

  const rawSleepResults = [];
  const sleepBatchSize = 10;
  if (displayName) {
    for (let i = 0; i < sleepDates.length; i += sleepBatchSize) {
      const batch = sleepDates.slice(i, i + sleepBatchSize);
      const batchRes = await Promise.all(
        batch.map(async (cdate) => {
          try {
            const res = await apiGet(
              `/wellness-service/wellness/dailySleepData/${encodeURIComponent(displayName)}`,
              { date: cdate, nonSleepBufferMinutes: 60 },
              4000
            );
            return res ? { date: cdate, data: res } : null;
          } catch (e) {
            return null;
          }
        })
      );
      rawSleepResults.push(...batchRes.filter(Boolean));
    }
  }

  const sleepRecords = [];
  for (const item of rawSleepResults) {
    const sleepJson = item?.data;
    const dto = sleepJson?.dailySleepDTO;
    if (dto && (dto.sleepTimeSeconds > 0 || dto.sleepStartTimestampLocal)) {
      const durationSecs = dto.sleepTimeSeconds || 0;
      const deepSecs = dto.deepSleepSeconds || 0;
      const lightSecs = dto.lightSleepSeconds || 0;
      const remSecs = dto.remSleepSeconds || 0;
      const awakeSecs = dto.awakeSleepSeconds || 0;
      const score = dto.sleepScores?.overall?.value ?? null;
      const qualifier = dto.sleepScores?.overall?.qualifierKey || null;

      sleepRecords.push({
        date: item.date,
        duration_seconds: durationSecs,
        duration_hours: Math.round((durationSecs / 3600) * 100) / 100,
        deep_seconds: deepSecs,
        deep_hours: Math.round((deepSecs / 3600) * 100) / 100,
        light_seconds: lightSecs,
        light_hours: Math.round((lightSecs / 3600) * 100) / 100,
        rem_seconds: remSecs,
        rem_hours: Math.round((remSecs / 3600) * 100) / 100,
        awake_seconds: awakeSecs,
        awake_hours: Math.round((awakeSecs / 3600) * 100) / 100,
        score,
        qualifier,
        avg_hr: dto.avgHeartRate || sleepJson.restingHeartRate || null,
        avg_stress: dto.avgSleepStress || null,
        avg_hrv: sleepJson.avgOvernightHrv || null,
        hrv_status: sleepJson.hrvStatus || null,
        body_battery_change: sleepJson.bodyBatteryChange || null,
        avg_spo2: dto.averageSpO2Value || null,
        avg_respiration: dto.averageRespirationValue || null,
        start_time: dto.sleepStartTimestampLocal || null,
        end_time: dto.sleepEndTimestampLocal || null,
      });
    }
  }

  // Sort chronological ascending (oldest -> newest)
  sleepRecords.sort((a, b) => a.date.localeCompare(b.date));

  // 10. Fitness Metrics History (VO2 Max, Resting HR & Fitness Age - Up to 1 Year)
  const allMetricDateSet = new Set();
  // Include past 365 days keys where we have any data
  Object.keys(dailyRhrMap).forEach(d => allMetricDateSet.add(d));
  Object.keys(dailyVo2Map).forEach(d => allMetricDateSet.add(d));
  sleepRecords.forEach(s => { if (s.date) allMetricDateSet.add(s.date); });
  // Also ensure recent 30 days are included
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    allMetricDateSet.add(d.toISOString().slice(0, 10));
  }

  const sortedMetricDates = Array.from(allMetricDateSet).sort();
  const fitnessMetricsHistory = [];

  for (const dateKey of sortedMetricDates) {
    let dayRhr = dailyRhrMap[dateKey] || null;
    if (!dayRhr) {
      const matchedSleep = sleepRecords.find(s => s.date === dateKey);
      if (matchedSleep?.avg_hr) dayRhr = Math.round(matchedSleep.avg_hr);
    }
    if (!dayRhr && dateKey === todayStr && rhr) {
      dayRhr = rhr;
    }

    const dayVo2 = dailyVo2Map[dateKey] ?? (dateKey === todayStr && vo2max ? vo2max : null);

    // Calculate historical fitness age based on VO2 Max and RHR progression
    let dayFitAge = fitnessAge || null;
    if (fitnessAge && (dayVo2 != null || dayRhr != null)) {
      if (dateKey === todayStr) {
        dayFitAge = fitnessAge;
      } else {
        const vo2Diff = (vo2max && dayVo2) ? (vo2max - dayVo2) : 0;
        const rhrDiff = (rhr && dayRhr) ? (dayRhr - rhr) : 0;
        const estFitAge = fitnessAge + (vo2Diff * 0.4) + (rhrDiff * 0.1);
        dayFitAge = Math.max(18, Math.min(age || 60, Math.round(estFitAge * 10) / 10));
      }
    }

    if (dayRhr || dayVo2 || dayFitAge) {
      fitnessMetricsHistory.push({
        date: dateKey,
        vo2max: dayVo2 || null,
        resting_hr: dayRhr || null,
        fitness_age: dayFitAge || null,
      });
    }
  }

  return {
    age,
    gender,
    height_cm: heightCm,
    vo2max,
    resting_hr: rhr,
    fitness_age: fitnessAge,
    fitness_age_components: fitData.components || {},
    device,
    prs,
    shoes,
    daily_steps: dailySteps,
    body_battery: bodyBattery,
    sleep: sleepRecords,
    metrics_history: fitnessMetricsHistory,
    // Garmin 970+ new fields (fetched via native API)
    training_readiness: await (async () => {
      try {
        const raw = await apiGet(`/metrics-service/metrics/trainingreadiness/${todayStr}`);
        const trList = Array.isArray(raw) ? raw : (raw?.trainingReadinessDTOList || []);
        const tr = trList[0] || (raw && !Array.isArray(raw) && raw.score != null ? raw : null);
        if (!tr) return null;
        return {
          score: tr.score ?? null,
          level: tr.level ?? null,
          feedback_short: tr.feedbackShort ?? null,
          feedback_long: tr.feedbackLong ?? null,
          sleep_score: tr.sleepScore ?? null,
          recovery_time: tr.recoveryTime ?? null,
          hrv_weekly_avg: tr.hrvWeeklyAverage ?? null,
          acute_load: tr.acuteLoad ?? null,
          date: tr.calendarDate ?? null,
        };
      } catch { return null; }
    })(),
    hrv_summary: await (async () => {
      try {
        const raw = await apiGet(`/hrv-service/hrv/${todayStr}`);
        const hrv = raw?.hrvSummary;
        if (!hrv) return null;
        return {
          weekly_avg: hrv.weeklyAvg ?? null,
          last_night_avg: hrv.lastNightAvg ?? null,
          last_night_5min_high: hrv.lastNight5MinHigh ?? null,
          status: hrv.status ?? null,
          feedback: hrv.feedbackPhrase ?? null,
          baseline_low: hrv.baseline?.lowUpper ?? null,
          baseline_balanced_low: hrv.baseline?.balancedLow ?? null,
          baseline_balanced_high: hrv.baseline?.balancedUpper ?? null,
          date: hrv.calendarDate ?? null,
        };
      } catch { return null; }
    })(),
    race_predictions: await (async () => {
      try {
        const url = displayName
          ? `/metrics-service/metrics/racepredictions/latest/${encodeURIComponent(displayName)}`
          : '/metrics-service/metrics/racepredictions';
        const raw = await apiGet(url);
        if (!raw) return null;
        const f = (s) => {
          if (!s) return null;
          const sec = Math.round(s);
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const sc = sec % 60;
          return h > 0
            ? `${h}:${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`
            : `${m}:${sc.toString().padStart(2, '0')}`;
        };
        return {
          '5k_seconds': raw.time5K ?? null,
          '5k_time': f(raw.time5K),
          '10k_seconds': raw.time10K ?? null,
          '10k_time': f(raw.time10K),
          hm_seconds: raw.timeHalfMarathon ?? null,
          hm_time: f(raw.timeHalfMarathon),
          fm_seconds: raw.timeMarathon ?? null,
          fm_time: f(raw.timeMarathon),
          date: raw.calendarDate ?? null,
        };
      } catch { return null; }
    })(),
    running_ftp: await (async () => {
      try {
        const speedAndHr = await apiGet('/biometric-service/biometric/latestLactateThreshold').catch(() => null);
        const powerRaw = await apiGet(`/biometric-service/biometric/powerToWeight/latest/${todayStr}?sport=Running`).catch(() => null);

        let speedVal = null;
        let heartRateVal = null;
        if (Array.isArray(speedAndHr)) {
          for (const entry of speedAndHr) {
            if (entry.speed != null) speedVal = entry.speed;
            if (entry.heartRate != null || entry.hearRate != null) {
              heartRateVal = entry.heartRate || entry.hearRate;
            }
          }
        } else if (speedAndHr && typeof speedAndHr === 'object') {
          speedVal = speedAndHr.speed;
          heartRateVal = speedAndHr.heartRate || speedAndHr.hearRate;
        }

        const power = Array.isArray(powerRaw) ? (powerRaw[0] || {}) : (powerRaw || {});
        let ltPace = null;
        if (speedVal && speedVal > 0) {
          const speedMps = speedVal < 1.0 ? speedVal * 10.0 : speedVal;
          const paceSecs = 1000.0 / speedMps;
          const m = Math.floor(paceSecs / 60);
          const s = Math.round(paceSecs % 60);
          ltPace = `${m}:${s.toString().padStart(2, '0')}`;
        }
        return {
          ftp_watts: power.functionalThresholdPower ?? null,
          power_to_weight: power.powerToWeight ? Math.round(power.powerToWeight * 100) / 100 : null,
          lt_heart_rate: heartRateVal ?? null,
          lt_pace: ltPace,
          date: (power.calendarDate || '').slice(0, 10),
        };
      } catch { return null; }
    })(),
    training_load_balance: await (async () => {
      try {
        const raw = await apiGet(`/metrics-service/metrics/trainingstatus/aggregated/${todayStr}`);
        const lbMap = raw?.mostRecentTrainingLoadBalance?.metricsTrainingLoadBalanceDTOMap || {};
        const lb = Object.values(lbMap)[0] || null;
        if (!lb) return null;
        return {
          aerobic_low: Math.round(lb.monthlyLoadAerobicLow || 0),
          aerobic_high: Math.round(lb.monthlyLoadAerobicHigh || 0),
          anaerobic: Math.round(lb.monthlyLoadAnaerobic || 0),
          aerobic_low_min: lb.monthlyLoadAerobicLowTargetMin ?? null,
          aerobic_low_max: lb.monthlyLoadAerobicLowTargetMax ?? null,
          aerobic_high_min: lb.monthlyLoadAerobicHighTargetMin ?? null,
          aerobic_high_max: lb.monthlyLoadAerobicHighTargetMax ?? null,
          anaerobic_min: lb.monthlyLoadAnaerobicTargetMin ?? null,
          anaerobic_max: lb.monthlyLoadAnaerobicTargetMax ?? null,
          feedback: lb.trainingBalanceFeedbackPhrase ?? null,
        };
      } catch { return null; }
    })(),
    synced_at: new Date().toISOString(),
  };
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request) {
  try {
    const tokens = await getGarminTokens();
    if (!tokens || !tokens.di_token) {
      return Response.json(
        {
          success: false,
          error: 'Garmin tokens are missing. Please authenticate with: python scripts/login_garmin.py',
        },
        { status: 500 }
      );
    }

    const data = await fetchGarminProfileData(tokens);
    const supabase = getServerSupabase();

    if (supabase) {
      // 1. Fetch current profile to ensure we never overwrite weight/OCR body composition
      const { data: existingProfiles } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', '1')
        .limit(1);

      const existing = (existingProfiles && existingProfiles[0]) || {};

      const vo2ToSave = data.vo2max != null ? data.vo2max : existing.vo2max;

      // Prepare updates - STRICTLY EXCLUDE weight_kg, muscle_kg, body_fat_pct, etc.
      const updates = {
        id: '1',
        age: data.age !== null && data.age !== undefined ? data.age : existing.age,
        gender: data.gender || existing.gender || 'M',
        height_cm: data.height_cm || existing.height_cm,
        vo2max: vo2ToSave,
        resting_hr: data.resting_hr || existing.resting_hr,
        fitness_age_data: {
          ...(data.fitness_age_components || existing.fitness_age_data || {}),
          fr970: {
            training_readiness: data.training_readiness,
            hrv_summary: data.hrv_summary,
            race_predictions: data.race_predictions,
            running_ftp: data.running_ftp,
            training_load_balance: data.training_load_balance,
            synced_at: data.synced_at,
          },
        },
        lactate_threshold_pace: data.running_ftp?.lt_pace || existing.lactate_threshold_pace,
        garmin_device: data.device ?? existing.garmin_device,
        garmin_prs: data.prs ?? existing.garmin_prs,
        garmin_gear: data.shoes ?? existing.garmin_gear,
        garmin_daily_steps: data.daily_steps ?? existing.garmin_daily_steps,
        garmin_body_battery: data.body_battery ?? existing.garmin_body_battery,
        garmin_sleep: data.sleep ?? existing.garmin_sleep,
        garmin_metrics_history: data.metrics_history ?? existing.garmin_metrics_history,
        last_garmin_sync: data.synced_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let { error: upsertErr } = await supabase
        .from('user_profile')
        .upsert(updates);

      if (upsertErr && (upsertErr.message?.includes('integer') || upsertErr.code === '22P02')) {
        // If DB user_profile.vo2max column is still INTEGER type, round it for user_profile table
        updates.vo2max = vo2ToSave != null ? Math.round(vo2ToSave) : null;
        const retryRes = await supabase.from('user_profile').upsert(updates);
        upsertErr = retryRes.error;
      }

      if (upsertErr) {
        console.warn('Supabase upsert with full columns failed, falling back to basic columns:', upsertErr.message);
        const basicUpdates = {
          id: '1',
          age: data.age !== null && data.age !== undefined ? data.age : existing.age,
          gender: data.gender || existing.gender || 'M',
          height_cm: data.height_cm || existing.height_cm,
          vo2max: data.vo2max || existing.vo2max,
          resting_hr: data.resting_hr || existing.resting_hr,
          updated_at: new Date().toISOString(),
        };
        const { error: fallbackErr } = await supabase.from('user_profile').upsert(basicUpdates);
        if (fallbackErr) console.error('Supabase fallback upsert error:', fallbackErr.message);
      }

      // Upsert into fitness_metrics_history table if available
      if (Array.isArray(data.metrics_history) && data.metrics_history.length > 0) {
        try {
          const rows = data.metrics_history.map(m => ({
            profile_id: '1',
            date: m.date,
            vo2max: m.vo2max,
            resting_hr: m.resting_hr,
            fitness_age: m.fitness_age,
          }));
          await supabase.from('fitness_metrics_history').upsert(rows, { onConflict: 'profile_id,date' });
        } catch (e) {
          console.warn('fitness_metrics_history table upsert error:', e);
        }
      }
    }

    return Response.json({
      success: true,
      data,
      message: 'Garmin profile successfully synchronized (weight excluded).',
    });
  } catch (err) {
    console.error('[garmin-profile-sync error]', err);
    return Response.json(
      { success: false, error: err.message || 'Internal error during Garmin profile sync' },
      { status: 500 }
    );
  }
}
