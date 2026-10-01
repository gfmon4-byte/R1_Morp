#!/usr/bin/env python3
"""
scripts/fetch_runs.py  –  Export running activities to CSV (same format as Garmin Connect web export).

Usage:
  python scripts/fetch_runs.py --days 30       # last 30 days
  python scripts/fetch_runs.py --days 90       # last 90 days
  python scripts/fetch_runs.py --out my.csv    # custom output filename
"""

from __future__ import annotations

import csv
import json
import sys
from datetime import date, timedelta
from pathlib import Path
import argparse

# Fix Windows console encoding for Unicode
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parent.parent

RUNNING_TYPES = {"running", "treadmill_running", "track_running", "trail_running"}

# CSV columns matching Garmin Connect web export format
COLUMNS = [
    "Activity Type", "Date", "Favorite", "Title",
    "Distance", "Calories", "Time",
    "Avg HR", "Max HR",
    "Avg Run Cadence", "Max Run Cadence",
    "Avg Pace", "Best Pace",
    "Total Ascent", "Total Descent",
    "Avg Stride Length",
    "Avg Vertical Ratio", "Avg Vertical Oscillation",
    "Avg Ground Contact Time",
    "Normalized Power® (NP®)", "Training Stress Score®",
    "Avg Power", "Max Power",
    "Steps", "Body Battery Drain",
    "Decompression", "Best Lap Time", "Number of Laps",
    "Moving Time", "Elapsed Time",
    "Min Elevation", "Max Elevation",
]


import os
import tempfile
import urllib.request

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
    except Exception as e:
        print(f"⚠️ Error reading tokens from Supabase: {e}")
    return None

def get_client():
    try:
        from garminconnect import Garmin
    except ImportError:
        sys.exit("ERROR: run  pip install -r requirements.txt  first")

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
        sys.exit("ERROR: No tokens found in Supabase garmin_tokens table or GARMIN_TOKENS_JSON env var.")

    temp_token_dir = Path(tempfile.gettempdir()) / "garmin_tokens_env"
    temp_token_dir.mkdir(parents=True, exist_ok=True)
    temp_token_file = temp_token_dir / "garmin_tokens.json"
    temp_token_file.write_text(json.dumps(tokens), encoding="utf-8")

    client = Garmin(email="", password="")
    client.login(tokenstore=str(temp_token_file))
    return client


def fmt_time(seconds) -> str:
    if seconds is None:
        return "--"
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sc = divmod(rem, 60)
    if h:
        return f"{h:02d}:{m:02d}:{sc:02d}"
    return f"{m:02d}:{sc:02d}"


def fmt_pace(seconds_per_meter) -> str:
    """Convert m/s speed to min/km pace string."""
    if not seconds_per_meter or seconds_per_meter <= 0:
        return "--"
    # averageSpeed is in m/s
    pace_sec_per_km = 1000 / seconds_per_meter
    m = int(pace_sec_per_km // 60)
    s = int(pace_sec_per_km % 60)
    return f"{m}:{s:02d}"


def fmt_val(v, decimals=2, suffix="") -> str:
    if v is None:
        return "--"
    if isinstance(v, float):
        return f"{v:.{decimals}f}{suffix}"
    return str(v)


def activity_to_row(act: dict) -> dict:
    atype_key = (act.get("activityType") or {}).get("typeKey", "")

    # Map internal typeKey to display name
    type_map = {
        "running": "Running",
        "treadmill_running": "Treadmill Running",
        "track_running": "Track Running",
        "trail_running": "Trail Running",
    }
    act_type = type_map.get(atype_key, atype_key.replace("_", " ").title())

    # Speeds → pace
    avg_speed = act.get("averageSpeed")  # m/s
    max_speed = act.get("maxSpeed")      # m/s

    # Distance
    dist_m = act.get("distance") or 0
    dist_km = dist_m / 1000

    # Elevation
    min_elev = act.get("minElevation")
    max_elev = act.get("maxElevation")

    # Cadence (steps/min for running)
    avg_cad = act.get("averageRunningCadenceInStepsPerMinute") or act.get("averageBikingCadenceInRevPerMinute")
    max_cad = act.get("maxRunningCadenceInStepsPerMinute") or act.get("maxBikingCadenceInRevPerMinute")

    # Steps
    steps = act.get("steps")
    steps_str = f"{int(steps):,}" if steps else "--"

    # Body battery drain
    bb_drain = act.get("bodyBatteryDrainedDuringActivity")
    bb_str = f"'-{int(abs(bb_drain))}" if bb_drain else "--"

    # Laps / best lap
    num_laps = act.get("lapCount") or act.get("numberOfLaps")

    # Stride length (convert cm/mm to meters)
    raw_stride = act.get("avgStrideLength")
    if raw_stride and raw_stride > 1000:
        stride = round(raw_stride / 1000.0, 2)
    elif raw_stride and raw_stride > 10:
        stride = round(raw_stride / 100.0, 2)
    elif raw_stride:
        stride = round(float(raw_stride), 2)
    else:
        stride = None

    # Vertical oscillation / ratio / ground contact
    vert_osc = act.get("avgVerticalOscillation")   # cm
    vert_ratio = act.get("avgVerticalRatio")         # %
    gct = act.get("avgGroundContactTime")            # ms

    return {
        "Activity Type": act_type,
        "Date": (act.get("startTimeLocal") or "")[:19].replace("T", " "),
        "Favorite": "true" if act.get("favorite") else "false",
        "Title": act.get("activityName") or "",
        "Distance": f"{dist_km:.2f}" if dist_km else "--",
        "Calories": fmt_val(act.get("calories"), 0),
        "Time": fmt_time(act.get("duration")),
        "Avg HR": fmt_val(act.get("averageHR"), 0),
        "Max HR": fmt_val(act.get("maxHR"), 0),
        "Avg Run Cadence": fmt_val(avg_cad, 0) if avg_cad else "--",
        "Max Run Cadence": fmt_val(max_cad, 0) if max_cad else "--",
        "Avg Pace": fmt_pace(avg_speed),
        "Best Pace": fmt_pace(max_speed),
        "Total Ascent": fmt_val(act.get("elevationGain"), 0),
        "Total Descent": fmt_val(act.get("elevationLoss"), 0),
        "Avg Stride Length": f"{stride:.2f}" if stride else "--",
        "Avg Vertical Ratio": f"{vert_ratio:.1f}" if vert_ratio else "--",
        "Avg Vertical Oscillation": f"{vert_osc:.1f}" if vert_osc else "--",
        "Avg Ground Contact Time": fmt_val(gct, 0) if gct else "--",
        "Normalized Power® (NP®)": fmt_val(act.get("normPower"), 0),
        "Training Stress Score®": fmt_val(act.get("trainingStressScore"), 1),
        "Avg Power": fmt_val(act.get("avgPower"), 0),
        "Max Power": fmt_val(act.get("maxPower"), 0),
        "Steps": steps_str,
        "Body Battery Drain": bb_str,
        "Decompression": "No",
        "Best Lap Time": "--",
        "Number of Laps": str(num_laps) if num_laps else "--",
        "Moving Time": fmt_time(act.get("movingDuration")),
        "Elapsed Time": fmt_time(act.get("elapsedDuration")),
        "Min Elevation": fmt_val(min_elev, 0) if min_elev else "--",
        "Max Elevation": fmt_val(max_elev, 0) if max_elev else "--",
    }


def activity_to_db_row(act: dict) -> dict:
    """Convert a raw Garmin activity dict to a Supabase activities-table row.
    Column names must exactly match the 'activities' table schema."""
    atype_key = (act.get("activityType") or {}).get("typeKey", "")
    type_map = {
        "running": "Running",
        "treadmill_running": "Treadmill Running",
        "track_running": "Track Running",
        "trail_running": "Trail Running",
    }
    act_type = type_map.get(atype_key, atype_key.replace("_", " ").title())

    avg_speed = act.get("averageSpeed")  # m/s
    max_speed = act.get("maxSpeed")      # m/s
    dist_m = act.get("distance") or 0

    def _pace_str(speed_ms):
        """Convert m/s to 'M:SS' string, e.g. '5:30'."""
        if not speed_ms or speed_ms <= 0:
            return "--"
        secs = 1000 / speed_ms  # seconds per km
        m = int(secs // 60)
        s = int(secs % 60)
        return f"{m}:{s:02d}"

    duration_s = act.get("duration")
    bb = act.get("bodyBatteryDrainedDuringActivity")

    def _to_int(v):
        """Round float → int, return None if missing."""
        if v is None:
            return None
        try:
            return int(round(float(v)))
        except (TypeError, ValueError):
            return None

    def _format_stride(v):
        if v is None:
            return None
        try:
            n = float(v)
            if n <= 0:
                return None
            if n > 1000:
                return round(n / 1000.0, 2)
            if n > 10:
                return round(n / 100.0, 2)
            return round(n, 2)
        except (TypeError, ValueError):
            return None

    return {
        "id": str(act.get("activityId") or ""),
        "activity_type": act_type,
        "date": (act.get("startTimeLocal") or "")[:19].replace("T", " "),
        "title": act.get("activityName") or "",
        "distance": round(dist_m / 1000, 2) if dist_m else None,
        "calories": _to_int(act.get("calories")),
        "duration_seconds": _to_int(duration_s),
        "avg_hr": _to_int(act.get("averageHR")),
        "max_hr": _to_int(act.get("maxHR")),
        "avg_cadence": _to_int(
            act.get("averageRunningCadenceInStepsPerMinute")
            or act.get("averageBikingCadenceInRevPerMinute")
        ),
        "max_cadence": _to_int(
            act.get("maxRunningCadenceInStepsPerMinute")
            or act.get("maxBikingCadenceInRevPerMinute")
        ),
        "avg_pace": _pace_str(avg_speed),
        "best_pace": _pace_str(max_speed),
        "total_ascent": _to_int(act.get("elevationGain")),
        "total_descent": _to_int(act.get("elevationLoss")),
        "avg_stride_length": _format_stride(act.get("avgStrideLength")),
        "avg_vertical_oscillation": act.get("avgVerticalOscillation"),
        "avg_vertical_ratio": act.get("avgVerticalRatio"),
        "avg_ground_contact_time": _to_int(act.get("avgGroundContactTime")),
        "steps": _to_int(act.get("steps")),
        "body_battery_drain": _to_int(abs(bb)) if bb else None,
    }




def main():
    parser = argparse.ArgumentParser(description="Export Garmin running activities to CSV or JSON")
    parser.add_argument("--days", type=int, default=30, help="How many past days to fetch (default: 30)")
    parser.add_argument("--out", default="", help="Output CSV filename (default: running_<date>.csv)")
    parser.add_argument("--all-types", action="store_true", help="Include all activity types, not just running")
    parser.add_argument("--json", action="store_true", help="Output JSON array to stdout instead of CSV file")
    args = parser.parse_args()

    out_file = args.out or f"running_{date.today().isoformat()}.csv"

    client = get_client()

    until = date.today()
    since = until - timedelta(days=args.days - 1)
    print(f"Fetching activities: {since} to {until} ...")

    activities = client.get_activities_by_date(since.isoformat(), until.isoformat())
    if not activities:
        print("No activities found.")
        return

    if not args.all_types:
        runs = [
            a for a in activities
            if (a.get("activityType") or {}).get("typeKey", "") in RUNNING_TYPES
        ]
    else:
        runs = activities

    print(f"Found {len(runs)} running activities (out of {len(activities)} total)")

    if not runs:
        print("No running activities in this date range. Use --all-types to include everything.")
        return

    if args.json:
        # Output JSON to stdout for programmatic consumption (e.g. Next.js API route)
        db_rows = [activity_to_db_row(a) for a in runs]
        print(json.dumps(db_rows, ensure_ascii=False))
        return

    rows = [activity_to_row(a) for a in runs]

    with open(out_file, "w", newline="", encoding="utf-8-sig") as f:  # utf-8-sig for Excel compat
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Saved {len(rows)} activities to: {out_file}")
    print("\nPreview:")
    print(f"  {'Date':<22} {'Title':<25} {'Dist':>6} {'Time':<10} {'HR':>5} {'Pace':<7}")
    print(f"  {'-'*22} {'-'*25} {'-'*6} {'-'*10} {'-'*5} {'-'*7}")
    for r in rows:
        print(f"  {r['Date']:<22} {r['Title']:<25} {r['Distance']:>6} {r['Time']:<10} {r['Avg HR']:>5} {r['Avg Pace']:<7}")


if __name__ == "__main__":
    main()
