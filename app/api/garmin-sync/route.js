import { createClient } from "@supabase/supabase-js";
import { getGarminTokens, saveGarminTokens } from "@/lib/garminTokens";

// Exact constants from garminconnect Python library (client.py)
const ACTIVITIES_URL =
  "https://connectapi.garmin.com/activitylist-service/activities/search/activities";
const DI_TOKEN_URL =
  "https://diauth.garmin.com/di-oauth2-service/oauth/token";

// Native Android app headers required by Garmin's connectapi
function nativeHeaders(extra = {}) {
  return {
    "User-Agent": "GCM-Android-5.23",
    "X-Garmin-User-Agent":
      "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
    "X-Garmin-Paired-App-Version": "10861",
    "X-Garmin-Client-Platform": "Android",
    "X-App-Ver": "10861",
    "X-Lang": "en",
    "X-GCExperience": "GC5",
    "Accept-Language": "en-US,en;q=0.9",
    ...extra,
  };
}

const RUNNING_TYPES = new Set([
  "running",
  "treadmill_running",
  "track_running",
  "trail_running",
]);

const TYPE_MAP = {
  running: "Running",
  treadmill_running: "Treadmill Running",
  track_running: "Track Running",
  trail_running: "Trail Running",
};

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function paceStr(speedMs) {
  if (!speedMs || speedMs <= 0) return "--";
  const secsPerKm = 1000 / speedMs;
  const m = Math.floor(secsPerKm / 60);
  const s = Math.floor(secsPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function toInt(v) {
  if (v == null) return null;
  const n = Math.round(Number(v));
  return isNaN(n) ? null : n;
}

function formatStrideLength(val) {
  if (val == null || isNaN(Number(val))) return null;
  const num = Number(val);
  if (num <= 0) return null;
  if (num > 1000) return Math.round((num / 1000) * 100) / 100;
  if (num > 10) return Math.round((num / 100) * 100) / 100;
  return Math.round(num * 100) / 100;
}

function formatVertOsc(val) {
  if (val == null || isNaN(Number(val))) return null;
  const num = Number(val);
  if (num > 100) return Math.round((num / 10) * 10) / 10;
  return Math.round(num * 10) / 10;
}

function activityToDbRow(act) {
  const typeKey = (act.activityType || {}).typeKey || "";
  const actType =
    TYPE_MAP[typeKey] ||
    typeKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const distM = act.distance || 0;
  const bb = act.bodyBatteryDrainedDuringActivity || act.differenceBodyBattery;

  return {
    id: String(act.activityId || ""),
    activity_type: actType,
    date: act.startTimeGMT
      ? act.startTimeGMT.slice(0, 19).replace(" ", "T") + "Z"
      : act.startTimeLocal
        ? act.startTimeLocal.slice(0, 19).replace(" ", "T") + "+07:00"
        : "",
    title: act.activityName || "",
    distance: distM ? Math.round((distM / 1000) * 100) / 100 : null,
    calories: toInt(act.calories),
    duration_seconds: toInt(act.duration),
    avg_hr: toInt(act.averageHR),
    max_hr: toInt(act.maxHR),
    avg_cadence: toInt(
      act.averageRunningCadenceInStepsPerMinute ||
        act.averageBikingCadenceInRevPerMinute
    ),
    max_cadence: toInt(
      act.maxRunningCadenceInStepsPerMinute ||
        act.maxBikingCadenceInRevPerMinute
    ),
    avg_pace: paceStr(act.averageSpeed),
    best_pace: paceStr(act.maxSpeed),
    total_ascent: toInt(act.elevationGain),
    total_descent: toInt(act.elevationLoss),
    avg_stride_length: formatStrideLength(act.avgStrideLength),
    avg_vertical_oscillation: formatVertOsc(act.avgVerticalOscillation),
    avg_vertical_ratio: act.avgVerticalRatio != null ? Math.round(Number(act.avgVerticalRatio) * 10) / 10 : null,
    avg_ground_contact_time: toInt(act.avgGroundContactTime),
    steps: toInt(act.steps),
    body_battery_drain: bb ? toInt(Math.abs(bb)) : null,
  };
}

/** Decode JWT payload — handles base64url (JWT standard) */
function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    // base64url → base64
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(pad, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/** Check if a JWT token is expired or expires within the next 15 minutes */
function tokenExpiresSoon(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  return Date.now() / 1000 > payload.exp - 900;
}

/** Refresh DI token using refresh_token grant */
async function refreshDiToken(diRefreshToken, diClientId) {
  const basicAuth = Buffer.from(`${diClientId}:`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: diClientId,
    refresh_token: diRefreshToken,
  });

  const res = await fetch(DI_TOKEN_URL, {
    method: "POST",
    headers: nativeHeaders({
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    }),
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 400 || res.status === 401) {
      throw new Error(
        `Garmin refresh token expired or invalid (${res.status}). Please re-authenticate via the Garmin Login tab.`
      );
    }
    throw new Error(`Token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function callActivitiesApi(diToken, days, syncAll = false) {
  const until = new Date();
  let since;
  if (syncAll) {
    since = new Date('2000-01-01');
  } else {
    since = new Date();
    since.setDate(since.getDate() - (days - 1));
  }
  const fmt = (d) => d.toISOString().slice(0, 10);

  const headers = nativeHeaders({
    Authorization: `Bearer ${diToken}`,
    Accept: "application/json",
  });

  const activities = [];
  const limit = 50;
  let start = 0;

  while (true) {
    const params = new URLSearchParams({
      startDate: fmt(since),
      endDate: fmt(until),
      start: String(start),
      limit: String(limit),
    });

    const res = await fetch(`${ACTIVITIES_URL}?${params}`, { headers });

    if (res.status === 401) {
      // Signal caller to refresh token and retry
      throw Object.assign(new Error("401"), { status: 401 });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Garmin API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    activities.push(...page);
    if (page.length < limit) break;
    start += limit;
  }

  return activities
    .filter((a) => RUNNING_TYPES.has((a.activityType || {}).typeKey || ""))
    .map(activityToDbRow);
}

async function fetchGarminActivities(tokens, days, syncAll = false) {
  let { di_token, di_refresh_token, di_client_id } = tokens;

  // Pre-check: refresh if token is expired or expiring soon
  if (tokenExpiresSoon(di_token)) {
    if (!di_refresh_token || !di_client_id) {
      throw new Error("DI token is expired and no refresh token available.");
    }
    di_token = await refreshDiToken(di_refresh_token, di_client_id);
    saveGarminTokens({ ...tokens, di_token }).catch(() => {});
  }

  try {
    return await callActivitiesApi(di_token, days, syncAll);
  } catch (err) {
    // Retry once on 401 — refresh token may have been stale despite pre-check
    if (err.status === 401) {
      if (!di_refresh_token || !di_client_id) {
        throw new Error("Garmin 401: token expired and no refresh token available.");
      }
      di_token = await refreshDiToken(di_refresh_token, di_client_id);
      saveGarminTokens({ ...tokens, di_token }).catch(() => {});
      return await callActivitiesApi(di_token, days, syncAll);
    }
    throw err;
  }
}

function paceToSeconds(paceString) {
  if (!paceString || paceString === "--") return 0;
  const parts = paceString.split(":");
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function classifyRun(activity) {
  const { activity_type, distance, avg_pace, avg_hr, title } = activity;
  if (activity_type === "Treadmill Running") return "treadmill";

  const dist = parseFloat(distance) || 0;
  const paceS = paceToSeconds(avg_pace);
  const hr = parseInt(avg_hr, 10) || 0;

  const RACE_LOCATIONS = ["Khlong Luang", "Phra Nakhon"];
  if (RACE_LOCATIONS.some((loc) => title?.includes(loc))) return "tempo";
  if (paceS > 0 && paceS < 245 && hr >= 170) return "tempo";
  if (dist >= 15 && paceS >= 270) return "long_run";
  if (dist >= 4 && paceS > 0 && paceS <= 300 && hr >= 155) return "tempo";
  if (dist >= 14) return "long_run";
  return "easy";
}

async function importActivitiesToDb(supabase, newRows) {
  const { data: existing, error: fetchErr } = await supabase
    .from("activities")
    .select("id");
  if (fetchErr) throw new Error("Fetch existing failed: " + fetchErr.message);

  // Garmin activityId is a globally unique integer — use it as the sole dedup key.
  // The previous time+distance fuzzy match caused false negatives when the date format
  // changed (legacy rows have no TZ, new rows have +07:00) making timeDiff = 7 hours
  // which exceeded the 300-second threshold, allowing the same run to be inserted twice.
  const existingIds = new Set((existing || []).map((a) => a.id));
  const filtered = newRows.filter((a) => !existingIds.has(a.id));

  if (filtered.length === 0) return { inserted: 0, skipped: newRows.length };

  const rowsToInsert = filtered.map((act) => ({
    ...act,
    run_type: act.run_type || classifyRun(act),
  }));

  // Use upsert (on conflict id) instead of plain insert to safely handle
  // cases where the same activity ID is re-synced (e.g. Garmin resends same run).
  const { error: insertErr } = await supabase
    .from("activities")
    .upsert(rowsToInsert, { onConflict: "id", ignoreDuplicates: false });
  if (insertErr) throw new Error("Insert failed: " + insertErr.message);

  return { inserted: rowsToInsert.length, skipped: newRows.length - rowsToInsert.length };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const syncAll = body.all === true;
    const days = syncAll ? 365 : Math.max(1, Math.min(365, parseInt(body.days, 10) || 7));

    // Load tokens from Supabase (or env-var fallback)
    const tokens = await getGarminTokens();

    if (!tokens || !tokens.di_token) {
      return Response.json(
        {
          success: false,
          needsLogin: true,
          error:
            "Garmin tokens are missing or expired. Please re-authenticate via the Garmin Login tab.",
        },
        { status: 401 }
      );
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return Response.json(
        { success: false, error: "Supabase is not configured." },
        { status: 500 }
      );
    }

    const rows = await fetchGarminActivities(tokens, days, syncAll);

    if (rows.length === 0) {
      return Response.json({ success: true, inserted: 0, skipped: 0, total: 0 });
    }

    const { inserted, skipped } = await importActivitiesToDb(supabase, rows);
    return Response.json({ success: true, inserted, skipped, total: rows.length, syncAll });
  } catch (err) {
    console.error("[garmin-sync]", err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
