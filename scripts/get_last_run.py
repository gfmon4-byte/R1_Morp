#!/usr/bin/env python3
"""
scripts/get_last_run.py - Fetches running activity sessions from Garmin Connect with full multi-session support (WU + Main + CD).
Outputs complete structured JSON to stdout.
"""

from __future__ import annotations
import json
import sys
import os
import math
from datetime import datetime
from pathlib import Path

# Fix Windows console encoding for Unicode
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import urllib.request
import tempfile

ROOT_DIR = Path(__file__).resolve().parent.parent

RUNNING_TYPES = {"running", "treadmill_running", "track_running", "trail_running", "street_running", "obstacle_run"}


def get_tokens_from_supabase() -> dict | None:
    env_file = ROOT_DIR / ".env.local"
    env = {}
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not key:
        return None

    req_url = f"{url.rstrip('/')}/rest/v1/garmin_tokens?id=eq.1&select=tokens_json"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    req = urllib.request.Request(req_url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data and isinstance(data, list) and len(data) > 0:
                return data[0].get("tokens_json")
    except Exception:
        pass
    return None


def get_client():
    try:
        from garminconnect import Garmin
    except ImportError:
        sys.exit(json.dumps({"status": "error", "message": "garminconnect is not installed"}))

    tokens = None
    token_json_env = os.environ.get("GARMIN_TOKENS_JSON")
    if token_json_env:
        try:
            tokens = json.loads(token_json_env)
        except Exception:
            pass

    if not tokens:
        tokens = get_tokens_from_supabase()

    if not tokens:
        sys.exit(json.dumps({"status": "error", "message": "No Garmin token found in Supabase garmin_tokens table"}))

    temp_token_dir = Path(tempfile.gettempdir()) / "garmin_tokens_env"
    temp_token_dir.mkdir(parents=True, exist_ok=True)
    temp_token_file = temp_token_dir / "garmin_tokens.json"
    temp_token_file.write_text(json.dumps(tokens), encoding="utf-8")

    client = Garmin()
    client.login(tokenstore=str(temp_token_file))
    return client


def fmt_duration(seconds) -> str:
    if seconds is None or math.isnan(float(seconds)):
        return "--"
    s = int(round(float(seconds)))
    h, rem = divmod(s, 3600)
    m, sc = divmod(rem, 60)
    if h > 0:
        return f"{h:02d}:{m:02d}:{sc:02d}"
    return f"{m:02d}:{sc:02d}"


def speed_to_pace(speed_ms) -> str:
    """Convert m/s speed to min/km pace string MM:SS."""
    if not speed_ms or float(speed_ms) <= 0:
        return "--"
    pace_sec = 1000.0 / float(speed_ms)
    m = int(pace_sec // 60)
    s = int(round(pace_sec % 60))
    if s >= 60:
        m += 1
        s = 0
    return f"{m}:{s:02d}"


def speed_to_kph(speed_ms) -> float | None:
    if not speed_ms or float(speed_ms) <= 0:
        return None
    return round(float(speed_ms) * 3.6, 2)


def fahrenheit_to_celsius(f_temp) -> float | None:
    if f_temp is None:
        return None
    return round((float(f_temp) - 32) * 5 / 9, 1)


def safe_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception:
        return None


def detect_part_type(title: str, idx: int, total: int) -> str:
    t = (title or "").lower().strip()
    if "wu" in t or "warm" in t:
        return "WU (Warm Up)"
    if "cd" in t or "cool" in t:
        return "CD (Cool Down)"
    if "interval" in t or "tempo" in t or "repeat" in t or "main" in t or "speed" in t or "fast" in t:
        return "Main Set"
    if total == 3:
        if idx == 1:
            return "WU (Warm Up)"
        elif idx == 2:
            return "Main Set"
        elif idx == 3:
            return "CD (Cool Down)"
    return f"Part {idx}"


def build_csv_summary(summary, activity_name, start_time, activity_type, part_label=None) -> str:
    cols = [
        "Part", "Activity Type", "Date", "Title", "Distance (km)", "Duration",
        "Moving Duration", "Elapsed Duration", "Avg Pace (min/km)", "Best Pace (min/km)",
        "Avg Speed (km/h)", "Max Speed (km/h)", "Avg HR (bpm)", "Max HR (bpm)",
        "Avg Cadence (spm)", "Max Cadence (spm)", "Calories (kcal)", "Elevation Gain (m)",
        "Elevation Loss (m)", "Min Elevation (m)", "Max Elevation (m)",
        "Avg Stride Length (m)", "Avg Ground Contact Time (ms)", "Avg Vertical Oscillation (cm)",
        "Avg Vertical Ratio (%)", "Aerobic TE", "Anaerobic TE", "TE Label",
        "Body Battery Drain", "Steps"
    ]
    vals = [
        f'"{part_label or "Session"}"',
        f'"{activity_type}"',
        f'"{start_time}"',
        f'"{activity_name}"',
        str(summary.get("distance_km", "")),
        f'"{summary.get("duration_formatted", "")}"',
        f'"{summary.get("moving_duration_formatted", "")}"',
        f'"{summary.get("elapsed_duration_formatted", "")}"',
        f'"{summary.get("avg_pace", "")}"',
        f'"{summary.get("best_pace", "")}"',
        str(summary.get("avg_speed_kph", "")),
        str(summary.get("max_speed_kph", "")),
        str(summary.get("avg_hr", "") or ""),
        str(summary.get("max_hr", "") or ""),
        str(summary.get("avg_cadence", "") or ""),
        str(summary.get("max_cadence", "") or ""),
        str(summary.get("calories", "") or ""),
        str(summary.get("elevation_gain_m", "") or ""),
        str(summary.get("elevation_loss_m", "") or ""),
        str(summary.get("min_elevation_m", "") or ""),
        str(summary.get("max_elevation_m", "") or ""),
        str(summary.get("avg_stride_length_m", "") or ""),
        str(summary.get("avg_ground_contact_time_ms", "") or ""),
        str(summary.get("avg_vertical_oscillation_cm", "") or ""),
        str(summary.get("avg_vertical_ratio_percent", "") or ""),
        str(summary.get("aerobic_training_effect", "") or ""),
        str(summary.get("anaerobic_training_effect", "") or ""),
        f'"{summary.get("training_effect_label", "") or ""}"',
        str(summary.get("body_battery_drain", "") or ""),
        str(summary.get("steps", "") or "")
    ]
    return ",".join(cols) + "\n" + ",".join(vals)


def build_csv_laps(laps) -> str:
    if not laps:
        return ""
    cols = [
        "Part", "Lap", "Distance (km)", "Duration", "Moving Duration", "Avg Pace (min/km)",
        "Avg Speed (km/h)", "Avg HR (bpm)", "Max HR (bpm)", "Avg Cadence (spm)",
        "Max Cadence (spm)", "Elevation Gain (m)", "Elevation Loss (m)",
        "Avg Stride Length (m)", "Avg GCT (ms)", "Avg Vertical Oscillation (cm)",
        "Avg Vertical Ratio (%)", "Calories (kcal)"
    ]
    lines = [",".join(cols)]
    for l in laps:
        part_tag = l.get("part_name") or l.get("part_label") or "Lap"
        row = [
            f'"{part_tag}"',
            str(l.get("lap_index", "")),
            str(l.get("distance_km", "")),
            f'"{l.get("duration_formatted", "")}"',
            f'"{l.get("moving_duration_formatted", "")}"',
            f'"{l.get("avg_pace", "")}"',
            str(l.get("avg_speed_kph", "")),
            str(l.get("avg_hr", "") or ""),
            str(l.get("max_hr", "") or ""),
            str(l.get("avg_cadence", "") or ""),
            str(l.get("max_cadence", "") or ""),
            str(l.get("elevation_gain_m", "") or ""),
            str(l.get("elevation_loss_m", "") or ""),
            str(l.get("avg_stride_length_m", "") or ""),
            str(l.get("avg_ground_contact_time_ms", "") or ""),
            str(l.get("avg_vertical_oscillation_cm", "") or ""),
            str(l.get("avg_vertical_ratio_percent", "") or ""),
            str(l.get("calories", "") or "")
        ]
        lines.append(",".join(row))
    return "\n".join(lines)


def process_single_activity(client, act_item: dict, part_idx: int = 1, total_parts: int = 1) -> dict:
    act_id = act_item.get("activityId")
    act_name = act_item.get("activityName") or "Running Activity"
    part_type = detect_part_type(act_name, part_idx, total_parts)

    act_service_data = safe_call(client.get_activity, act_id) or {}
    splits_data = safe_call(client.get_activity_splits, act_id) or {}
    hr_zones_data = safe_call(client.get_activity_hr_in_timezones, act_id) or []
    weather_data = safe_call(client.get_activity_weather, act_id) or {}
    gear_data = safe_call(client.get_activity_gear, act_id) or []

    summary_dto = act_service_data.get("summaryDTO") or {}
    metadata_dto = act_service_data.get("metadataDTO") or {}
    activity_type_dto = act_service_data.get("activityTypeDTO") or act_item.get("activityType") or {}

    dist_m = summary_dto.get("distance") or act_item.get("distance") or 0.0
    dist_km = round(dist_m / 1000.0, 2)
    dur_sec = summary_dto.get("duration") or act_item.get("duration") or 0.0
    mov_sec = summary_dto.get("movingDuration") or act_item.get("movingDuration") or dur_sec
    elp_sec = summary_dto.get("elapsedDuration") or act_item.get("elapsedDuration") or dur_sec

    avg_spd = summary_dto.get("averageSpeed") or act_item.get("averageSpeed")
    max_spd = summary_dto.get("maxSpeed") or act_item.get("maxSpeed")

    avg_hr = summary_dto.get("averageHR") or act_item.get("averageHR")
    max_hr = summary_dto.get("maxHR") or act_item.get("maxHR")
    min_hr = summary_dto.get("minHR") or act_item.get("minHR")
    avg_cad = summary_dto.get("averageRunCadence") or act_item.get("averageRunningCadenceInStepsPerMinute")
    max_cad = summary_dto.get("maxRunCadence") or act_item.get("maxRunningCadenceInStepsPerMinute")

    stride_len = summary_dto.get("strideLength") or act_item.get("avgStrideLength")
    if stride_len and stride_len > 10:
        stride_len = round(stride_len / 100.0, 2) if stride_len < 1000 else round(stride_len / 1000.0, 2)
    elif stride_len:
        stride_len = round(float(stride_len), 2)

    gct = summary_dto.get("groundContactTime") or act_item.get("avgGroundContactTime")
    vert_osc = summary_dto.get("verticalOscillation") or act_item.get("avgVerticalOscillation")
    if vert_osc and vert_osc > 100:
        vert_osc = round(vert_osc / 10.0, 1)
    elif vert_osc:
        vert_osc = round(float(vert_osc), 1)

    vert_ratio = summary_dto.get("verticalRatio") or act_item.get("avgVerticalRatio")
    if vert_ratio:
        vert_ratio = round(float(vert_ratio), 1)

    elev_gain = summary_dto.get("elevationGain") or act_item.get("elevationGain")
    elev_loss = summary_dto.get("elevationLoss") or act_item.get("elevationLoss")
    min_elev = summary_dto.get("minElevation") or act_item.get("minElevation")
    max_elev = summary_dto.get("maxElevation") or act_item.get("maxElevation")
    avg_elev = summary_dto.get("avgElevation") or act_item.get("avgElevation")

    calories = summary_dto.get("calories") or act_item.get("calories")
    bmr_calories = summary_dto.get("bmrCalories") or act_item.get("bmrCalories")
    bb_drain = summary_dto.get("differenceBodyBattery") or act_item.get("bodyBatteryDrainedDuringActivity")
    if bb_drain:
        bb_drain = abs(int(bb_drain))

    steps = summary_dto.get("steps") or act_item.get("steps")
    rec_hr = summary_dto.get("recoveryHeartRate")
    aerobic_te = metadata_dto.get("trainingEffect") or act_item.get("aerobicTrainingEffect")
    anaerobic_te = metadata_dto.get("anaerobicTrainingEffect") or act_item.get("anaerobicTrainingEffect")
    te_label = summary_dto.get("trainingEffectLabel") or metadata_dto.get("trainingEffectLabel")

    start_time_local = summary_dto.get("startTimeLocal") or act_item.get("startTimeLocal") or ""
    start_time_gmt = summary_dto.get("startTimeGMT") or act_item.get("startTimeGMT") or ""
    act_type_name = activity_type_dto.get("typeKey") or "running"

    summary_clean = {
        "distance_km": dist_km,
        "distance_meters": round(dist_m, 2),
        "duration_seconds": int(dur_sec),
        "duration_formatted": fmt_duration(dur_sec),
        "moving_duration_seconds": int(mov_sec),
        "moving_duration_formatted": fmt_duration(mov_sec),
        "elapsed_duration_seconds": int(elp_sec),
        "elapsed_duration_formatted": fmt_duration(elp_sec),
        "avg_pace": speed_to_pace(avg_spd),
        "avg_speed_kph": speed_to_kph(avg_spd),
        "best_pace": speed_to_pace(max_spd),
        "max_speed_kph": speed_to_kph(max_spd),
        "avg_hr": int(avg_hr) if avg_hr else None,
        "max_hr": int(max_hr) if max_hr else None,
        "min_hr": int(min_hr) if min_hr else None,
        "avg_cadence": int(avg_cad) if avg_cad else None,
        "max_cadence": int(max_cad) if max_cad else None,
        "avg_stride_length_m": stride_len,
        "avg_ground_contact_time_ms": int(round(gct)) if gct else None,
        "avg_vertical_oscillation_cm": vert_osc,
        "avg_vertical_ratio_percent": vert_ratio,
        "elevation_gain_m": int(round(elev_gain)) if elev_gain is not None else None,
        "elevation_loss_m": int(round(elev_loss)) if elev_loss is not None else None,
        "min_elevation_m": round(min_elev, 1) if min_elev is not None else None,
        "max_elevation_m": round(max_elev, 1) if max_elev is not None else None,
        "avg_elevation_m": round(avg_elev, 1) if avg_elev is not None else None,
        "calories": int(calories) if calories else None,
        "bmr_calories": int(bmr_calories) if bmr_calories else None,
        "body_battery_drain": bb_drain,
        "steps": int(steps) if steps else None,
        "recovery_hr": int(rec_hr) if rec_hr else None,
        "aerobic_training_effect": round(float(aerobic_te), 1) if aerobic_te is not None else None,
        "aerobic_training_effect_message": summary_dto.get("aerobicTrainingEffectMessage"),
        "anaerobic_training_effect": round(float(anaerobic_te), 1) if anaerobic_te is not None else None,
        "anaerobic_training_effect_message": summary_dto.get("anaerobicTrainingEffectMessage"),
        "training_effect_label": te_label,
        "water_estimated_ml": summary_dto.get("waterEstimated"),
        "moderate_intensity_minutes": summary_dto.get("moderateIntensityMinutes"),
        "vigorous_intensity_minutes": summary_dto.get("vigorousIntensityMinutes"),
    }

    # Laps
    lap_dtos = splits_data.get("lapDTOs") or []
    laps_clean = []
    for idx, lap in enumerate(lap_dtos, 1):
        l_dist = lap.get("distance", 0.0)
        l_dur = lap.get("duration", 0.0)
        l_mov = lap.get("movingDuration", l_dur)
        l_spd = lap.get("averageSpeed", 0.0)
        l_stride = lap.get("strideLength")
        if l_stride and l_stride > 10:
            l_stride = round(l_stride / 100.0, 2) if l_stride < 1000 else round(l_stride / 1000.0, 2)
        elif l_stride:
            l_stride = round(float(l_stride), 2)

        l_vert_osc = lap.get("verticalOscillation")
        if l_vert_osc and l_vert_osc > 100:
            l_vert_osc = round(l_vert_osc / 10.0, 1)
        elif l_vert_osc:
            l_vert_osc = round(float(l_vert_osc), 1)

        laps_clean.append({
            "part_index": part_idx,
            "part_name": act_name,
            "part_label": part_type,
            "lap_index": lap.get("lapIndex") or idx,
            "distance_km": round(l_dist / 1000.0, 2),
            "distance_meters": round(l_dist, 2),
            "duration_seconds": int(l_dur),
            "duration_formatted": fmt_duration(l_dur),
            "moving_duration_seconds": int(l_mov),
            "moving_duration_formatted": fmt_duration(l_mov),
            "avg_pace": speed_to_pace(l_spd),
            "avg_speed_kph": speed_to_kph(l_spd),
            "avg_hr": int(lap["averageHR"]) if lap.get("averageHR") else None,
            "max_hr": int(lap["maxHR"]) if lap.get("maxHR") else None,
            "avg_cadence": int(lap["averageRunCadence"]) if lap.get("averageRunCadence") else None,
            "max_cadence": int(lap["maxRunCadence"]) if lap.get("maxRunCadence") else None,
            "elevation_gain_m": int(round(lap["elevationGain"])) if lap.get("elevationGain") is not None else None,
            "elevation_loss_m": int(round(lap["elevationLoss"])) if lap.get("elevationLoss") is not None else None,
            "avg_stride_length_m": l_stride,
            "avg_ground_contact_time_ms": int(round(lap["groundContactTime"])) if lap.get("groundContactTime") else None,
            "avg_vertical_oscillation_cm": l_vert_osc,
            "avg_vertical_ratio_percent": round(lap["verticalRatio"], 1) if lap.get("verticalRatio") else None,
            "calories": int(lap["calories"]) if lap.get("calories") else None,
        })

    # HR Zones
    total_zone_secs = sum(z.get("secsInZone", 0) for z in hr_zones_data) if hr_zones_data else 0
    zone_names = {
        1: "Warm Up (Zone 1)",
        2: "Easy / Fat Burn (Zone 2)",
        3: "Aerobic (Zone 3)",
        4: "Threshold (Zone 4)",
        5: "Maximum (Zone 5)"
    }
    hr_zones_clean = []
    for z in sorted(hr_zones_data, key=lambda x: x.get("zoneNumber", 0)):
        z_num = z.get("zoneNumber", 0)
        secs = z.get("secsInZone", 0)
        pct = round((secs / total_zone_secs * 100), 1) if total_zone_secs > 0 else 0
        hr_zones_clean.append({
            "zone_number": z_num,
            "zone_name": zone_names.get(z_num, f"Zone {z_num}"),
            "min_bpm": z.get("zoneLowBoundary"),
            "seconds_in_zone": round(secs, 1),
            "duration_formatted": fmt_duration(secs),
            "percentage": pct
        })

    # Weather
    weather_clean = None
    if weather_data:
        temp_f = weather_data.get("temp")
        app_temp_f = weather_data.get("apparentTemp")
        weather_clean = {
            "temperature_c": fahrenheit_to_celsius(temp_f) if temp_f is not None else None,
            "apparent_temperature_c": fahrenheit_to_celsius(app_temp_f) if app_temp_f is not None else None,
            "relative_humidity_percent": weather_data.get("relativeHumidity"),
            "wind_speed_kph": round(weather_data.get("windSpeed", 0) * 1.60934, 1) if weather_data.get("windSpeed") is not None else None,
            "wind_direction_compass": (weather_data.get("windDirectionCompassPoint") or "").upper(),
            "condition": (weather_data.get("weatherTypeDTO") or {}).get("desc") or "Clear",
            "weather_issue_time": weather_data.get("issueDate")
        }

    # Gear
    gear_clean = []
    if gear_data and isinstance(gear_data, list):
        for g in gear_data:
            gear_clean.append({
                "gear_name": g.get("customMakeModel") or g.get("displayName") or g.get("gearPk"),
                "brand": g.get("makeName"),
                "model": g.get("modelName"),
                "gear_type": g.get("gearTypeName"),
                "total_distance_km": round((g.get("totalDistance") or 0) / 1000.0, 1) if g.get("totalDistance") else None
            })

    csv_summary_str = build_csv_summary(summary_clean, act_name, start_time_local, act_type_name, part_label=part_type)
    csv_laps_str = build_csv_laps(laps_clean)
    combined_csv = f"# GARMIN ACTIVITY SUMMARY - {part_type}\n{csv_summary_str}\n\n# LAPS / SPLITS BREAKDOWN\n{csv_laps_str}"

    return {
        "part_index": part_idx,
        "part_type": part_type,
        "activity_id": act_id,
        "activity_name": act_name,
        "activity_type": act_type_name,
        "start_time_local": start_time_local,
        "start_time_gmt": start_time_gmt,
        "location_name": act_service_data.get("locationName") or act_item.get("locationName"),
        "garmin_connect_url": f"https://connect.garmin.com/modern/activity/{act_id}",
        "summary": summary_clean,
        "laps": laps_clean,
        "hr_zones": hr_zones_clean,
        "weather": weather_clean,
        "gear": gear_clean,
        "csv_exports": {
            "summary_csv": csv_summary_str,
            "laps_csv": csv_laps_str,
            "combined_csv": combined_csv
        },
        "raw_garmin": {
            "activity_search_item": act_item,
            "activity_service": act_service_data,
            "splits": splits_data,
            "hr_zones": hr_zones_data,
            "weather": weather_data,
            "gear": gear_data
        }
    }


def main():
    target_date_arg = None
    for arg in sys.argv[1:]:
        if arg.startswith("--date="):
            target_date_arg = arg.split("=", 1)[1].strip()
        elif arg == "--date" and len(sys.argv) > sys.argv.index(arg) + 1:
            target_date_arg = sys.argv[sys.argv.index(arg) + 1].strip()

    try:
        client = get_client()

        # Fetch recent activities (up to 35 activities to locate target date or latest session)
        activities = client.get_activities(0, 35)
        if not activities:
            sys.exit(json.dumps({"status": "error", "message": "No activities found in Garmin account"}))

        running_acts = [
            a for a in activities
            if (a.get("activityType", {}).get("typeKey") or "").lower() in RUNNING_TYPES
        ]

        if not running_acts:
            sys.exit(json.dumps({"status": "error", "message": "No running activities found"}))

        # Group running activities by date (YYYY-MM-DD)
        runs_by_date = {}
        for a in running_acts:
            dt_local = (a.get("startTimeLocal") or "")[:10]
            dt_gmt = (a.get("startTimeGMT") or "")[:10]
            if dt_local:
                runs_by_date.setdefault(dt_local, []).append(a)
            if dt_gmt and dt_gmt != dt_local:
                if a not in runs_by_date.setdefault(dt_gmt, []):
                    runs_by_date[dt_gmt].append(a)

        # Build list of available recent sessions for UI selector
        available_sessions = []
        for d_str, day_items in sorted(runs_by_date.items(), reverse=True):
            tot_km = round(sum((x.get("distance") or 0) / 1000.0 for x in day_items), 2)
            c = len(day_items)
            label = f"{d_str}: {tot_km} km ({c} {'runs (Interval/Session)' if c > 1 else 'run'})"
            available_sessions.append({
                "date": d_str,
                "label": label,
                "runs_count": c,
                "total_km": tot_km
            })

        # Determine target date
        if target_date_arg:
            if target_date_arg not in runs_by_date:
                specific_acts = safe_call(client.get_activities_by_date, target_date_arg, target_date_arg, "running") or []
                if not specific_acts:
                    specific_acts = safe_call(client.get_activities_by_date, target_date_arg, target_date_arg) or []
                if specific_acts:
                    runs_by_date[target_date_arg] = [
                        a for a in specific_acts
                        if (a.get("activityType", {}).get("typeKey") or "").lower() in RUNNING_TYPES
                    ] or specific_acts
            if target_date_arg in runs_by_date and runs_by_date[target_date_arg]:
                session_date = target_date_arg
            else:
                sys.exit(json.dumps({"status": "error", "message": f"ไม่พบกิจกรรมการวิ่งในวันที่ {target_date_arg}"}))
        else:
            # Default to the most recent date with running activities
            session_date = sorted(runs_by_date.keys(), reverse=True)[0]

        session_acts = runs_by_date[session_date]
        # Sort chronologically (earliest -> latest) e.g., WU (18:26) -> Main (18:46) -> CD (19:26)
        session_acts.sort(key=lambda a: a.get("startTimeLocal") or "")

        total_parts = len(session_acts)
        processed_parts = [None] * total_parts

        # Fetch all workout parts in parallel for maximum speed
        from concurrent.futures import ThreadPoolExecutor

        def fetch_part(idx_and_act):
            idx, act = idx_and_act
            return idx, process_single_activity(client, act, idx + 1, total_parts)

        with ThreadPoolExecutor(max_workers=min(5, max(1, total_parts))) as executor:
            for idx, res_part in executor.map(fetch_part, enumerate(session_acts)):
                processed_parts[idx] = res_part

        # If only 1 activity on that date
        if total_parts == 1:
            single = processed_parts[0]
            out = {
                "status": "success",
                **single,
                "is_multi_session": False,
                "session_date": session_date,
                "session_activities_count": 1,
                "parts": processed_parts,
                "available_sessions": available_sessions,
            }
        else:
            # Multiple activities on that date (WU + Main + CD) -> Build Combined Session
            tot_dist_km = round(sum(p["summary"]["distance_km"] for p in processed_parts), 2)
            tot_dist_m = round(sum(p["summary"]["distance_meters"] for p in processed_parts), 2)
            tot_dur_sec = sum(p["summary"]["duration_seconds"] for p in processed_parts)
            tot_mov_sec = sum(p["summary"]["moving_duration_seconds"] for p in processed_parts)
            tot_elp_sec = sum(p["summary"]["elapsed_duration_seconds"] for p in processed_parts)

            # Weighted calculations
            combined_avg_spd = (tot_dist_m / tot_mov_sec) if tot_mov_sec > 0 else 0.0
            max_spd_all = max((p["summary"].get("max_speed_kph") or 0.0) for p in processed_parts)
            best_pace_all = speed_to_pace(max_spd_all / 3.6) if max_spd_all > 0 else "--"

            # Weighted HR
            hr_weighted_sum = sum((p["summary"]["avg_hr"] or 0) * p["summary"]["moving_duration_seconds"] for p in processed_parts if p["summary"]["avg_hr"])
            hr_dur_sum = sum(p["summary"]["moving_duration_seconds"] for p in processed_parts if p["summary"]["avg_hr"])
            comb_avg_hr = int(round(hr_weighted_sum / hr_dur_sum)) if hr_dur_sum > 0 else None
            comb_max_hr = max((p["summary"].get("max_hr") or 0 for p in processed_parts), default=None)
            valid_min_hrs = [p["summary"].get("min_hr") for p in processed_parts if p["summary"].get("min_hr")]
            comb_min_hr = min(valid_min_hrs) if valid_min_hrs else None

            # Weighted Cadence
            cad_weighted_sum = sum((p["summary"]["avg_cadence"] or 0) * p["summary"]["moving_duration_seconds"] for p in processed_parts if p["summary"]["avg_cadence"])
            comb_avg_cad = int(round(cad_weighted_sum / hr_dur_sum)) if hr_dur_sum > 0 else None
            comb_max_cad = max((p["summary"].get("max_cadence") or 0 for p in processed_parts), default=None)

            # Weighted Running Dynamics
            stride_w = sum((p["summary"]["avg_stride_length_m"] or 0) * p["summary"]["moving_duration_seconds"] for p in processed_parts if p["summary"]["avg_stride_length_m"])
            comb_stride = round(stride_w / hr_dur_sum, 2) if hr_dur_sum > 0 and stride_w > 0 else None

            gct_w = sum((p["summary"]["avg_ground_contact_time_ms"] or 0) * p["summary"]["moving_duration_seconds"] for p in processed_parts if p["summary"]["avg_ground_contact_time_ms"])
            comb_gct = int(round(gct_w / hr_dur_sum)) if hr_dur_sum > 0 and gct_w > 0 else None

            vert_w = sum((p["summary"]["avg_vertical_oscillation_cm"] or 0) * p["summary"]["moving_duration_seconds"] for p in processed_parts if p["summary"]["avg_vertical_oscillation_cm"])
            comb_vert = round(vert_w / hr_dur_sum, 1) if hr_dur_sum > 0 and vert_w > 0 else None

            vert_r_w = sum((p["summary"]["avg_vertical_ratio_percent"] or 0) * p["summary"]["moving_duration_seconds"] for p in processed_parts if p["summary"]["avg_vertical_ratio_percent"])
            comb_vert_ratio = round(vert_r_w / hr_dur_sum, 1) if hr_dur_sum > 0 and vert_r_w > 0 else None

            tot_elev_gain = sum(p["summary"]["elevation_gain_m"] or 0 for p in processed_parts)
            tot_elev_loss = sum(p["summary"]["elevation_loss_m"] or 0 for p in processed_parts)
            tot_cals = sum(p["summary"]["calories"] or 0 for p in processed_parts)
            tot_steps = sum(p["summary"]["steps"] or 0 for p in processed_parts)
            tot_bb_drain = sum(p["summary"]["body_battery_drain"] or 0 for p in processed_parts)

            max_aerobic_te = max((p["summary"].get("aerobic_training_effect") or 0.0 for p in processed_parts), default=None)
            max_anaerobic_te = max((p["summary"].get("anaerobic_training_effect") or 0.0 for p in processed_parts), default=None)

            # Combined Summary object
            combined_summary = {
                "distance_km": tot_dist_km,
                "distance_meters": tot_dist_m,
                "duration_seconds": tot_dur_sec,
                "duration_formatted": fmt_duration(tot_dur_sec),
                "moving_duration_seconds": tot_mov_sec,
                "moving_duration_formatted": fmt_duration(tot_mov_sec),
                "elapsed_duration_seconds": tot_elp_sec,
                "elapsed_duration_formatted": fmt_duration(tot_elp_sec),
                "avg_pace": speed_to_pace(combined_avg_spd),
                "avg_speed_kph": speed_to_kph(combined_avg_spd),
                "best_pace": best_pace_all,
                "max_speed_kph": round(max_spd_all, 2) if max_spd_all > 0 else None,
                "avg_hr": comb_avg_hr,
                "max_hr": comb_max_hr if comb_max_hr else None,
                "min_hr": comb_min_hr,
                "avg_cadence": comb_avg_cad,
                "max_cadence": comb_max_cad if comb_max_cad else None,
                "avg_stride_length_m": comb_stride,
                "avg_ground_contact_time_ms": comb_gct,
                "avg_vertical_oscillation_cm": comb_vert,
                "avg_vertical_ratio_percent": comb_vert_ratio,
                "elevation_gain_m": tot_elev_gain if tot_elev_gain > 0 else 0,
                "elevation_loss_m": tot_elev_loss if tot_elev_loss > 0 else 0,
                "min_elevation_m": min((p["summary"].get("min_elevation_m") for p in processed_parts if p["summary"].get("min_elevation_m") is not None), default=None),
                "max_elevation_m": max((p["summary"].get("max_elevation_m") for p in processed_parts if p["summary"].get("max_elevation_m") is not None), default=None),
                "calories": tot_cals if tot_cals > 0 else None,
                "body_battery_drain": tot_bb_drain if tot_bb_drain > 0 else None,
                "steps": tot_steps if tot_steps > 0 else None,
                "aerobic_training_effect": max_aerobic_te,
                "anaerobic_training_effect": max_anaerobic_te,
                "training_effect_label": "INTERVAL / MULTI-SESSION",
            }

            # Combined Laps (Sequential order with part annotations)
            combined_laps = []
            lap_seq = 1
            for p in processed_parts:
                for l in p["laps"]:
                    combined_laps.append({
                        **l,
                        "session_lap_index": lap_seq,
                    })
                    lap_seq += 1

            # Combined HR Zones (Aggregate seconds in each zone)
            combined_hr_zones = []
            zone_time_map = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0}
            zone_min_map = {}
            for p in processed_parts:
                for z in p["hr_zones"]:
                    znum = z["zone_number"]
                    zone_time_map[znum] = zone_time_map.get(znum, 0.0) + (z.get("seconds_in_zone") or 0.0)
                    if z.get("min_bpm") and (znum not in zone_min_map or z["min_bpm"] < zone_min_map[znum]):
                        zone_min_map[znum] = z["min_bpm"]

            tot_comb_zone_sec = sum(zone_time_map.values())
            zone_names = {
                1: "Warm Up (Zone 1)",
                2: "Easy / Fat Burn (Zone 2)",
                3: "Aerobic (Zone 3)",
                4: "Threshold (Zone 4)",
                5: "Maximum (Zone 5)"
            }
            for znum in range(1, 6):
                sec = zone_time_map.get(znum, 0.0)
                pct = round((sec / tot_comb_zone_sec * 100), 1) if tot_comb_zone_sec > 0 else 0
                combined_hr_zones.append({
                    "zone_number": znum,
                    "zone_name": zone_names.get(znum, f"Zone {znum}"),
                    "min_bpm": zone_min_map.get(znum),
                    "seconds_in_zone": round(sec, 1),
                    "duration_formatted": fmt_duration(sec),
                    "percentage": pct
                })

            # Multi-part session title
            part_titles = " + ".join(p["activity_name"] for p in processed_parts)
            session_title = f"{session_date} Interval Session ({part_titles})"

            # Build Multi-Session CSV with all parts + TOTAL line
            csv_summary_rows = []
            summary_cols = [
                "Part", "Activity Type", "Date", "Title", "Distance (km)", "Duration",
                "Moving Duration", "Elapsed Duration", "Avg Pace (min/km)", "Best Pace (min/km)",
                "Avg Speed (km/h)", "Max Speed (km/h)", "Avg HR (bpm)", "Max HR (bpm)",
                "Avg Cadence (spm)", "Max Cadence (spm)", "Calories (kcal)", "Elevation Gain (m)",
                "Elevation Loss (m)", "Min Elevation (m)", "Max Elevation (m)",
                "Avg Stride Length (m)", "Avg Ground Contact Time (ms)", "Avg Vertical Oscillation (cm)",
                "Avg Vertical Ratio (%)", "Aerobic TE", "Anaerobic TE", "TE Label",
                "Body Battery Drain", "Steps"
            ]
            csv_summary_rows.append(",".join(summary_cols))
            for p in processed_parts:
                s = p["summary"]
                row = [
                    f'"{p["part_type"]}"',
                    f'"{p["activity_type"]}"',
                    f'"{p["start_time_local"]}"',
                    f'"{p["activity_name"]}"',
                    str(s.get("distance_km", "")),
                    f'"{s.get("duration_formatted", "")}"',
                    f'"{s.get("moving_duration_formatted", "")}"',
                    f'"{s.get("elapsed_duration_formatted", "")}"',
                    f'"{s.get("avg_pace", "")}"',
                    f'"{s.get("best_pace", "")}"',
                    str(s.get("avg_speed_kph", "")),
                    str(s.get("max_speed_kph", "")),
                    str(s.get("avg_hr", "") or ""),
                    str(s.get("max_hr", "") or ""),
                    str(s.get("avg_cadence", "") or ""),
                    str(s.get("max_cadence", "") or ""),
                    str(s.get("calories", "") or ""),
                    str(s.get("elevation_gain_m", "") or ""),
                    str(s.get("elevation_loss_m", "") or ""),
                    str(s.get("min_elevation_m", "") or ""),
                    str(s.get("max_elevation_m", "") or ""),
                    str(s.get("avg_stride_length_m", "") or ""),
                    str(s.get("avg_ground_contact_time_ms", "") or ""),
                    str(s.get("avg_vertical_oscillation_cm", "") or ""),
                    str(s.get("avg_vertical_ratio_percent", "") or ""),
                    str(s.get("aerobic_training_effect", "") or ""),
                    str(s.get("anaerobic_training_effect", "") or ""),
                    f'"{s.get("training_effect_label", "") or ""}"',
                    str(s.get("body_battery_drain", "") or ""),
                    str(s.get("steps", "") or "")
                ]
                csv_summary_rows.append(",".join(row))

            # Add TOTAL SUMMARY ROW
            cs = combined_summary
            tot_row = [
                '"TOTAL SESSION"',
                '"running"',
                f'"{processed_parts[0]["start_time_local"]}"',
                f'"{session_title}"',
                str(cs.get("distance_km", "")),
                f'"{cs.get("duration_formatted", "")}"',
                f'"{cs.get("moving_duration_formatted", "")}"',
                f'"{cs.get("elapsed_duration_formatted", "")}"',
                f'"{cs.get("avg_pace", "")}"',
                f'"{cs.get("best_pace", "")}"',
                str(cs.get("avg_speed_kph", "")),
                str(cs.get("max_speed_kph", "")),
                str(cs.get("avg_hr", "") or ""),
                str(cs.get("max_hr", "") or ""),
                str(cs.get("avg_cadence", "") or ""),
                str(cs.get("max_cadence", "") or ""),
                str(cs.get("calories", "") or ""),
                str(cs.get("elevation_gain_m", "") or ""),
                str(cs.get("elevation_loss_m", "") or ""),
                str(cs.get("min_elevation_m", "") or ""),
                str(cs.get("max_elevation_m", "") or ""),
                str(cs.get("avg_stride_length_m", "") or ""),
                str(cs.get("avg_ground_contact_time_ms", "") or ""),
                str(cs.get("avg_vertical_oscillation_cm", "") or ""),
                str(cs.get("avg_vertical_ratio_percent", "") or ""),
                str(cs.get("aerobic_training_effect", "") or ""),
                str(cs.get("anaerobic_training_effect", "") or ""),
                f'"{cs.get("training_effect_label", "") or ""}"',
                str(cs.get("body_battery_drain", "") or ""),
                str(cs.get("steps", "") or "")
            ]
            csv_summary_rows.append(",".join(tot_row))
            combined_summary_csv = "\n".join(csv_summary_rows)

            combined_laps_csv = build_csv_laps(combined_laps)
            full_combined_csv = (
                f"# GARMIN WORKOUT SESSION SUMMARY ({session_date})\n"
                f"{combined_summary_csv}\n\n"
                f"# ALL LAPS / SPLITS BREAKDOWN (WU + MAIN + CD)\n"
                f"{combined_laps_csv}"
            )

            out = {
                "status": "success",
                "is_multi_session": True,
                "session_date": session_date,
                "session_activities_count": total_parts,
                "activity_id": processed_parts[0]["activity_id"],
                "activity_name": session_title,
                "activity_type": "running",
                "start_time_local": processed_parts[0]["start_time_local"],
                "start_time_gmt": processed_parts[0]["start_time_gmt"],
                "location_name": processed_parts[0].get("location_name"),
                "garmin_connect_url": processed_parts[0].get("garmin_connect_url"),
                "summary": combined_summary,
                "parts": processed_parts,
                "laps": combined_laps,
                "hr_zones": combined_hr_zones,
                "weather": processed_parts[0].get("weather"),
                "gear": processed_parts[0].get("gear"),
                "available_sessions": available_sessions,
                "csv_exports": {
                    "summary_csv": combined_summary_csv,
                    "laps_csv": combined_laps_csv,
                    "combined_csv": full_combined_csv
                }
            }

        out_json_str = json.dumps(out, ensure_ascii=False)
        print(out_json_str)

    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Error fetching last run: {str(e)}"}))


if __name__ == "__main__":
    if "--cached-only" in sys.argv:
        target_d = None
        for a in sys.argv:
            if a.startswith("--date="):
                target_d = a.split("=", 1)[1].strip()
        temp_cache_dir = Path(tempfile.gettempdir()) / "garmin_cache"
        if target_d:
            df = temp_cache_dir / f"last_run_cache_{target_d}.json"
            if df.exists():
                try:
                    print(df.read_text(encoding="utf-8"))
                    sys.exit(0)
                except Exception:
                    pass
        cache_file = temp_cache_dir / "last_run_cache.json"
        if cache_file.exists():
            try:
                print(cache_file.read_text(encoding="utf-8"))
                sys.exit(0)
            except Exception:
                pass
        print(json.dumps({"status": "error", "message": "No cached last run data found"}))
        sys.exit(1)
    main()
