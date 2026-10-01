#!/usr/bin/env python3
"""sample_all.py - ดึง 1 sample จากทุก Garmin API method ที่มี"""
from __future__ import annotations
import json, sys
from datetime import date, timedelta
from pathlib import Path

import os, tempfile, urllib.request

ROOT_DIR = Path(__file__).resolve().parent.parent
TODAY      = date.today().isoformat()
WEEK_AGO   = (date.today() - timedelta(days=7)).isoformat()
MONTH_AGO  = (date.today() - timedelta(days=30)).isoformat()

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
        sys.exit("ERROR: pip install -r requirements.txt")

    tokens = get_tokens_from_supabase()
    if not tokens:
        sys.exit("ERROR: No token found in Supabase garmin_tokens table.")

    temp_token_dir = Path(tempfile.gettempdir()) / "garmin_tokens_env"
    temp_token_dir.mkdir(parents=True, exist_ok=True)
    temp_token_file = temp_token_dir / "garmin_tokens.json"
    temp_token_file.write_text(json.dumps(tokens), encoding="utf-8")

    c = Garmin()
    c.login(tokenstore=str(temp_token_file))
    return c

def safe(label, fn, *args, **kwargs):
    try:
        r = fn(*args, **kwargs)
        print(f"  OK  {label}", flush=True)
        return r
    except Exception as e:
        print(f"  ERR {label}: {e}", flush=True)
        return None

def first(data):
    return data[0] if isinstance(data, list) and data else data

def main():
    print("Connecting ..."); c = get_client()
    print(f"OK  Today={TODAY}  WeekAgo={WEEK_AGO}\n")
    o = {}

    print("[1] User & Profile")
    o["full_name"]             = safe("full_name",             c.get_full_name)
    o["unit_system"]           = safe("unit_system",           c.get_unit_system)
    o["user_profile"]          = safe("user_profile",          c.get_user_profile)
    o["userprofile_settings"]  = safe("userprofile_settings",  c.get_userprofile_settings)

    print("\n[2] Daily Health")
    o["stats"]                 = safe("stats",                 c.get_stats,                 TODAY)
    o["user_summary"]          = safe("user_summary",          c.get_user_summary,          TODAY)
    o["stats_and_body"]        = safe("stats_and_body",        c.get_stats_and_body,        TODAY)
    o["steps_data"]            = safe("steps_data",            c.get_steps_data,            TODAY)
    o["heart_rates"]           = safe("heart_rates",           c.get_heart_rates,           TODAY)
    o["rhr_day"]               = safe("rhr_day",               c.get_rhr_day,               TODAY)
    o["sleep_data"]            = safe("sleep_data",            c.get_sleep_data,            TODAY)
    o["all_day_stress"]        = safe("all_day_stress",        c.get_all_day_stress,        TODAY)
    o["hydration_data"]        = safe("hydration_data",        c.get_hydration_data,        TODAY)
    o["lifestyle_logging"]     = safe("lifestyle_logging",     c.get_lifestyle_logging_data,TODAY)

    print("\n[3] Advanced Health Metrics")
    o["training_readiness"]    = safe("training_readiness",    c.get_training_readiness,    TODAY)
    o["morning_readiness"]     = safe("morning_readiness",     c.get_morning_training_readiness, TODAY)
    o["training_status"]       = safe("training_status",       c.get_training_status,       TODAY)
    o["hrv_data"]              = safe("hrv_data",              c.get_hrv_data,              TODAY)
    o["respiration_data"]      = safe("respiration_data",      c.get_respiration_data,      TODAY)
    o["spo2_data"]             = safe("spo2_data",             c.get_spo2_data,             TODAY)
    o["max_metrics"]           = safe("max_metrics (VO2Max)",  c.get_max_metrics,           TODAY)
    o["fitnessage_data"]       = safe("fitnessage_data",       c.get_fitnessage_data,       TODAY)
    o["stress_data"]           = safe("stress_data",           c.get_stress_data,           TODAY)
    o["intensity_minutes"]     = safe("intensity_minutes",     c.get_intensity_minutes_data,TODAY)
    o["lactate_threshold"]     = safe("lactate_threshold",     c.get_lactate_threshold)
    o["running_tolerance"]     = safe("running_tolerance",     c.get_running_tolerance,     WEEK_AGO, TODAY)
    o["cycling_ftp"]           = safe("cycling_ftp",           c.get_cycling_ftp)

    print("\n[4] Historical Trends")
    o["daily_steps"]           = safe("daily_steps (7d)",      c.get_daily_steps,           WEEK_AGO, TODAY)
    o["body_battery"]          = safe("body_battery (7d)",     c.get_body_battery,          WEEK_AGO, TODAY)
    o["body_battery_events"]   = safe("body_battery_events",   c.get_body_battery_events,   WEEK_AGO)
    o["floors"]                = safe("floors",                c.get_floors,                WEEK_AGO)
    o["blood_pressure"]        = safe("blood_pressure (7d)",   c.get_blood_pressure,        WEEK_AGO, TODAY)
    o["weekly_steps"]          = first(safe("weekly_steps",    c.get_weekly_steps,          TODAY))
    o["weekly_stress"]         = first(safe("weekly_stress",   c.get_weekly_stress,         TODAY))
    o["weekly_intensity_min"]  = safe("weekly_intensity_min",  c.get_weekly_intensity_minutes, WEEK_AGO, TODAY)
    o["all_day_events"]        = safe("all_day_events",        c.get_all_day_events,        WEEK_AGO)

    print("\n[5] Activities")
    acts = safe("activities (last 5)", c.get_activities, 0, 5)
    o["activities_sample"]     = first(acts)
    o["last_activity"]         = safe("last_activity",         c.get_last_activity)
    o["activity_types"]        = first(safe("activity_types",  c.get_activity_types))
    o["count_activities"]      = safe("count_activities",      c.count_activities)
    o["personal_record"]       = safe("personal_record",       c.get_personal_record)
    o["race_predictions"]      = safe("race_predictions",      c.get_race_predictions)

    act_id = (o["last_activity"] or {}).get("activityId")
    if act_id:
        print(f"  -> activity_id={act_id}")
        o["activity_details"]       = safe("activity_details",      c.get_activity_details,            act_id)
        o["activity_splits"]        = safe("activity_splits",       c.get_activity_splits,             act_id)
        o["activity_split_summaries"]= safe("split_summaries",      c.get_activity_split_summaries,    act_id)
        o["activity_typed_splits"]  = safe("typed_splits",          c.get_activity_typed_splits,       act_id)
        o["activity_hr_zones"]      = safe("activity_hr_zones",     c.get_activity_hr_in_timezones,    act_id)
        o["activity_power_zones"]   = safe("activity_power_zones",  c.get_activity_power_in_timezones, act_id)
        o["activity_weather"]       = safe("activity_weather",      c.get_activity_weather,            act_id)
        o["activity_gear"]          = safe("activity_gear",         c.get_activity_gear,               act_id)
        o["activity_exercise_sets"] = safe("activity_exercise_sets",c.get_activity_exercise_sets,      act_id)

    print("\n[6] Body Composition & Weight")
    o["body_composition"]      = safe("body_composition",      c.get_body_composition,      TODAY)
    o["weigh_ins"]             = safe("weigh_ins (7d)",        c.get_weigh_ins,             WEEK_AGO, TODAY)
    o["daily_weigh_ins"]       = safe("daily_weigh_ins",       c.get_daily_weigh_ins,       TODAY)

    print("\n[7] Goals & Achievements")
    o["goals_active"]          = safe("goals (active)",        c.get_goals, "active")
    o["earned_badges"]         = first(safe("earned_badges",   c.get_earned_badges))
    o["badge_challenges"]      = first(safe("badge_challenges",c.get_badge_challenges,  10))
    o["adhoc_challenges"]      = first(safe("adhoc_challenges",c.get_adhoc_challenges,  10))
    o["available_badges"]      = first(safe("available_badges",c.get_available_badges))
    o["in_progress_badges"]    = first(safe("in_progress_badges",c.get_in_progress_badges))
    o["virtual_challenges"]    = first(safe("virtual_challenges",c.get_inprogress_virtual_challenges, 10))
    o["hill_score"]            = safe("hill_score (7d)",       c.get_hill_score,            WEEK_AGO, TODAY)
    o["endurance_score"]       = safe("endurance_score (7d)",  c.get_endurance_score,       WEEK_AGO, TODAY)

    print("\n[8] Device & Technical")
    devices = safe("devices", c.get_devices)
    o["devices_sample"]        = first(devices)
    o["device_last_used"]      = safe("device_last_used",      c.get_device_last_used)
    o["primary_training_device"]= safe("primary_training_device", c.get_primary_training_device)
    dev_id = (first(devices) or {}).get("deviceId") if devices else None
    if dev_id:
        print(f"  -> device_id={dev_id}")
        o["device_settings"]   = safe("device_settings",       c.get_device_settings,   dev_id)
        o["device_alarms"]     = safe("device_alarms",         c.get_device_alarms)

    print("\n[9] Gear & Equipment")
    user_num = (o.get("user_profile") or {}).get("userData", {}).get("userProfileNumber") or (o.get("device_last_used") or {}).get("userProfileNumber")
    gear = safe("gear list", c.get_gear, user_num) if user_num else None
    o["gear_sample"]           = first(gear)
    o["gear_defaults"]         = safe("gear_defaults (running)", c.get_gear_defaults, "running")
    gear_uuid = (first(gear) or {}).get("uuid") or (first(gear) or {}).get("gearUuid") if gear else None
    if gear_uuid:
        o["gear_stats"]        = safe("gear_stats",            c.get_gear_stats,    gear_uuid)
        o["gear_activities"]   = first(safe("gear_activities", c.get_gear_activities, gear_uuid))

    print("\n[10] Nutrition & Wellness")
    o["nutrition_food_log"]    = safe("nutrition_food_log",    c.get_nutrition_daily_food_log,   TODAY)
    o["nutrition_meals"]       = safe("nutrition_meals",       c.get_nutrition_daily_meals,      TODAY)
    o["nutrition_settings"]    = safe("nutrition_settings",    c.get_nutrition_daily_settings,   TODAY)
    o["pregnancy_summary"]     = safe("pregnancy_summary",     c.get_pregnancy_summary)
    o["menstrual_data"]        = safe("menstrual_data",        c.get_menstrual_data_for_date,    TODAY)

    print("\n[11] Training Plans & Workouts")
    workouts = safe("workouts", c.get_workouts, 0, 5)
    o["workouts_sample"]       = first(workouts)
    plans = safe("training_plans", c.get_training_plans)
    o["training_plans_sample"] = first(plans)

    print("\n[12] Progress Summary")
    o["progress_summary"]      = safe("progress_summary (30d)", c.get_progress_summary_between_dates, MONTH_AGO, TODAY)

    # SAVE
    out_path = Path(__file__).parent / "sample_output.json"
    out_path.write_text(json.dumps(o, indent=2, default=str), encoding="utf-8")
    total = sum(1 for v in o.values() if v is not None)
    print(f"\n{'='*55}")
    print(f"Done! {total}/{len(o)} fields fetched")
    print(f"Saved -> {out_path}")

if __name__ == "__main__":
    main()
