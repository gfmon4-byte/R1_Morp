#!/usr/bin/env python3
"""
sync_garmin_profile.py - Fetch Garmin profile, fitness age, device, official PRs, and running shoes.
Outputs formatted JSON to stdout for consumption by Next.js API route.
"""
from __future__ import annotations
import json
import os
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path

import urllib.request

ROOT_DIR = Path(__file__).resolve().parent.parent

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
        sys.exit(json.dumps({"success": False, "error": "garminconnect package not installed"}))

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
        sys.exit(json.dumps({"success": False, "error": "No tokens found in Supabase DB (table garmin_tokens)"}))

    temp_token_dir = Path(tempfile.gettempdir()) / "garmin_tokens_env"
    temp_token_dir.mkdir(parents=True, exist_ok=True)
    temp_token_file = temp_token_dir / "garmin_tokens.json"
    temp_token_file.write_text(json.dumps(tokens), encoding="utf-8")

    c = Garmin()
    c.login(tokenstore=str(temp_token_file))
    return c

def fmt_time(seconds):
    if not seconds or seconds <= 0:
        return "--"
    s = int(round(seconds))
    h, rem = divmod(s, 3600)
    m, sc = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{sc:02d}"
    return f"{m}:{sc:02d}"

def main():
    try:
        c = get_client()
        today_str = date.today().isoformat()

        # 1. User Profile & Biometrics
        profile_data = c.get_user_profile() or {}
        user_data = profile_data.get("userData", {})
        user_num = user_data.get("userProfileNumber") or 116707114

        birth_date_str = user_data.get("birthDate")
        age = None
        if birth_date_str:
            try:
                b_date = datetime.strptime(birth_date_str, "%Y-%m-%d").date()
                t_date = date.today()
                age = t_date.year - b_date.year - ((t_date.month, t_date.day) < (b_date.month, b_date.day))
            except Exception:
                age = None

        height_cm = user_data.get("height")
        vo2max = user_data.get("vo2MaxRunning")
        gender = "M" if user_data.get("gender") == "MALE" else ("F" if user_data.get("gender") == "FEMALE" else "M")

        # 2. Fitness Age & Resting HR
        fit_data = c.get_fitnessage_data(today_str) or {}
        fitness_age = fit_data.get("fitnessAge")
        rhr = (fit_data.get("components") or {}).get("rhr", {}).get("value")
        if not rhr:
            try:
                rhr_day = c.get_rhr_day(today_str) or {}
                rhr = (rhr_day.get("allMetrics") or {}).get("metricsMap", {}).get("WELLNESS_RESTING_HEART_RATE", [{}])[0].get("value")
            except Exception:
                rhr = None

        # 3. Device Info
        dev_info = c.get_device_last_used() or {}
        device = {
            "name": dev_info.get("lastUsedDeviceName") or "Garmin Watch",
            "image_url": dev_info.get("imageUrl") or "",
            "last_upload": dev_info.get("lastUsedDeviceUploadTime"),
        }

        # 4. Official Personal Records (PRs)
        PR_MAP = {
            1: {"key": "1k", "label": "1K", "order": 1},
            2: {"key": "1mi", "label": "1 Mile", "order": 2},
            3: {"key": "5k", "label": "5K", "order": 3},
            4: {"key": "10k", "label": "10K", "order": 4},
            5: {"key": "hm", "label": "Half Marathon", "order": 5},
            6: {"key": "full", "label": "Full Marathon", "order": 6},
            7: {"key": "longest", "label": "Longest Run", "order": 7},
        }

        raw_prs = c.get_personal_record() or []
        prs = {}
        for p in raw_prs:
            tid = p.get("typeId")
            if tid in PR_MAP:
                conf = PR_MAP[tid]
                val = p.get("value")
                if tid == 7:  # Longest run in meters
                    dist_km = round(val / 1000.0, 2) if val else 0
                    prs[conf["key"]] = {
                        "key": conf["key"],
                        "label": conf["label"],
                        "order": conf["order"],
                        "distance_km": dist_km,
                        "time_str": f"{dist_km} km",
                        "activity_name": p.get("activityName") or "Longest Run",
                        "date": (p.get("actStartDateTimeInGMTFormatted") or "")[:10],
                    }
                else:
                    prs[conf["key"]] = {
                        "key": conf["key"],
                        "label": conf["label"],
                        "order": conf["order"],
                        "seconds": val,
                        "time_str": fmt_time(val),
                        "activity_name": p.get("activityName") or "Running",
                        "date": (p.get("actStartDateTimeInGMTFormatted") or "")[:10],
                    }

        # 5. Gear (Running Shoes)
        gears_raw = c.get_gear(user_num) or []
        shoes = []
        for g in gears_raw:
            if g.get("gearTypeName") == "Shoes" or g.get("customMakeModel") or g.get("displayName"):
                uuid = g.get("uuid")
                stats = c.get_gear_stats(uuid) if uuid else {}
                dist_km = round((stats.get("totalDistance") or 0) / 1000.0, 1)
                max_km = round((g.get("maximumMeters") or 0) / 1000.0, 1)
                wear_pct = round((dist_km / max_km * 100), 1) if max_km > 0 else 0
                shoes.append({
                    "uuid": uuid,
                    "name": g.get("displayName") or g.get("customMakeModel") or "Running Shoes",
                    "brand_model": g.get("customMakeModel") or g.get("gearModelName") or "",
                    "distance_km": dist_km,
                    "max_distance_km": max_km,
                    "wear_pct": wear_pct,
                    "status": g.get("gearStatusName") or "active",  # 'active' | 'retired'
                    "date_begin": (g.get("dateBegin") or "")[:10],
                })

        shoes.sort(key=lambda s: (0 if s["status"] == "active" else 1, -s["distance_km"]))

        # 6. Training Readiness (FR970+)
        training_readiness = None
        try:
            tr_raw = c.get_training_readiness(today_str)
            if tr_raw and isinstance(tr_raw, list) and len(tr_raw) > 0:
                tr = tr_raw[0]
                training_readiness = {
                    "score": tr.get("score"),
                    "level": tr.get("level"),
                    "feedback_short": tr.get("feedbackShort"),
                    "feedback_long": tr.get("feedbackLong"),
                    "sleep_score": tr.get("sleepScore"),
                    "recovery_time": tr.get("recoveryTime"),
                    "hrv_weekly_avg": tr.get("hrvWeeklyAverage"),
                    "acute_load": tr.get("acuteLoad"),
                    "date": tr.get("calendarDate"),
                }
        except Exception:
            pass

        # 7. HRV Status (FR970+)
        hrv_summary = None
        try:
            hrv_raw = c.get_hrv_data(today_str)
            if hrv_raw and isinstance(hrv_raw, dict):
                hrv_s = hrv_raw.get("hrvSummary") or {}
                hrv_summary = {
                    "weekly_avg": hrv_s.get("weeklyAvg"),
                    "last_night_avg": hrv_s.get("lastNightAvg"),
                    "last_night_5min_high": hrv_s.get("lastNight5MinHigh"),
                    "status": hrv_s.get("status"),
                    "feedback": hrv_s.get("feedbackPhrase"),
                    "baseline_low": (hrv_s.get("baseline") or {}).get("lowUpper"),
                    "baseline_balanced_low": (hrv_s.get("baseline") or {}).get("balancedLow"),
                    "baseline_balanced_high": (hrv_s.get("baseline") or {}).get("balancedUpper"),
                    "date": hrv_s.get("calendarDate"),
                }
        except Exception:
            pass

        # 8. Race Predictions (FR970+)
        race_predictions = None
        try:
            rp_raw = c.get_race_predictions()
            if rp_raw and isinstance(rp_raw, dict):
                def secs_to_time(s):
                    if not s: return None
                    s = int(s)
                    h, rem = divmod(s, 3600)
                    m, sc = divmod(rem, 60)
                    if h:
                        return f"{h}:{m:02d}:{sc:02d}"
                    return f"{m}:{sc:02d}"
                race_predictions = {
                    "5k_seconds": rp_raw.get("time5K"),
                    "5k_time": secs_to_time(rp_raw.get("time5K")),
                    "10k_seconds": rp_raw.get("time10K"),
                    "10k_time": secs_to_time(rp_raw.get("time10K")),
                    "hm_seconds": rp_raw.get("timeHalfMarathon"),
                    "hm_time": secs_to_time(rp_raw.get("timeHalfMarathon")),
                    "fm_seconds": rp_raw.get("timeMarathon"),
                    "fm_time": secs_to_time(rp_raw.get("timeMarathon")),
                    "date": rp_raw.get("calendarDate"),
                }
        except Exception:
            pass

        # 9. Running FTP & Power-to-Weight (FR970+)
        running_ftp = None
        try:
            lt_raw = c.get_lactate_threshold()
            if lt_raw and isinstance(lt_raw, dict):
                power_data = lt_raw.get("power") or {}
                hr_data = lt_raw.get("speed_and_heart_rate") or {}
                ftp_w = power_data.get("functionalThresholdPower")
                p2w = power_data.get("powerToWeight")
                lt_hr = hr_data.get("heartRate")
                lt_speed_raw = hr_data.get("speed")  # m/s
                lt_pace = None
                if lt_speed_raw and lt_speed_raw > 0:
                    speed_mps = lt_speed_raw * 10.0 if lt_speed_raw < 1.0 else lt_speed_raw
                    pace_secs_km = 1000.0 / speed_mps
                    m = int(pace_secs_km // 60)
                    s = int(pace_secs_km % 60)
                    lt_pace = f"{m}:{s:02d}"
                running_ftp = {
                    "ftp_watts": ftp_w,
                    "power_to_weight": round(p2w, 2) if p2w else None,
                    "lt_heart_rate": lt_hr,
                    "lt_pace": lt_pace,
                    "date": (power_data.get("calendarDate") or "")[:10],
                }
        except Exception:
            pass

        # 10. Training Load Balance (FR970+)
        training_load_balance = None
        try:
            ts_raw = c.get_training_status(today_str)
            if ts_raw and isinstance(ts_raw, dict):
                lb_map = (ts_raw.get("mostRecentTrainingLoadBalance") or {}).get("metricsTrainingLoadBalanceDTOMap") or {}
                lb = next(iter(lb_map.values()), None) if lb_map else None
                if lb:
                    training_load_balance = {
                        "aerobic_low": round(lb.get("monthlyLoadAerobicLow", 0)),
                        "aerobic_high": round(lb.get("monthlyLoadAerobicHigh", 0)),
                        "anaerobic": round(lb.get("monthlyLoadAnaerobic", 0)),
                        "aerobic_low_min": lb.get("monthlyLoadAerobicLowTargetMin"),
                        "aerobic_low_max": lb.get("monthlyLoadAerobicLowTargetMax"),
                        "aerobic_high_min": lb.get("monthlyLoadAerobicHighTargetMin"),
                        "aerobic_high_max": lb.get("monthlyLoadAerobicHighTargetMax"),
                        "anaerobic_min": lb.get("monthlyLoadAnaerobicTargetMin"),
                        "anaerobic_max": lb.get("monthlyLoadAnaerobicTargetMax"),
                        "feedback": lb.get("trainingBalanceFeedbackPhrase"),
                    }
        except Exception:
            pass

        # 11. Daily Steps (Last 7 Days) vs Dynamic Goal
        from datetime import timedelta
        week_ago_str = (date.today() - timedelta(days=7)).isoformat()

        raw_steps = c.get_daily_steps(week_ago_str, today_str) or []
        daily_steps = []
        for s in raw_steps:
            cal_date = s.get("calendarDate") or ""
            steps_val = s.get("totalSteps") or 0
            goal_val = s.get("stepGoal") or 10000
            dist_m = s.get("totalDistance") or 0
            dist_km = round(dist_m / 1000.0, 2)
            pct = round((steps_val / goal_val * 100), 1) if goal_val > 0 else 0
            daily_steps.append({
                "date": cal_date,
                "steps": steps_val,
                "goal": goal_val,
                "distance_km": dist_km,
                "hit_goal": steps_val >= goal_val,
                "pct": pct,
            })

        # 7. Body Battery Balance (Last 7 Days) (Charged vs Drained)
        raw_bb = c.get_body_battery(week_ago_str, today_str) or []
        body_battery = []
        for b in raw_bb:
            b_date = b.get("date") or ""
            charged = b.get("charged") or 0
            drained = b.get("drained") or 0
            net = charged - drained

            sleep_impact = 0
            nap_impact = 0
            for ev in (b.get("bodyBatteryActivityEvent") or []):
                if ev.get("eventType") == "SLEEP":
                    sleep_impact = ev.get("bodyBatteryImpact") or 0
                elif ev.get("eventType") == "NAP":
                    nap_impact = ev.get("bodyBatteryImpact") or 0

            feedback_event = b.get("bodyBatteryDynamicFeedbackEvent") or {}
            feedback_short = feedback_event.get("feedbackShortType") or ""

            body_battery.append({
                "date": b_date,
                "charged": charged,
                "drained": drained,
                "net": net,
                "sleep_impact": sleep_impact,
                "nap_impact": nap_impact,
                "feedback": feedback_short.replace("_", " ").title() if feedback_short else "",
            })

        # 8. Sleep Tracking Data (Last 30 Days)
        from concurrent.futures import ThreadPoolExecutor
        sleep_dates = [(date.today() - timedelta(days=i)).isoformat() for i in range(30)]

        def fetch_sleep_day(d_str):
            try:
                res = c.get_sleep_data(d_str)
                dto = res.get("dailySleepDTO") or {}
                if dto and (dto.get("sleepTimeSeconds", 0) > 0 or dto.get("sleepStartTimestampLocal")):
                    dur_secs = dto.get("sleepTimeSeconds") or 0
                    deep_secs = dto.get("deepSleepSeconds") or 0
                    light_secs = dto.get("lightSleepSeconds") or 0
                    rem_secs = dto.get("remSleepSeconds") or 0
                    awake_secs = dto.get("awakeSleepSeconds") or 0
                    scores = dto.get("sleepScores") or {}
                    overall = scores.get("overall") or {}

                    return {
                        "date": d_str,
                        "duration_seconds": dur_secs,
                        "duration_hours": round(dur_secs / 3600.0, 2),
                        "deep_seconds": deep_secs,
                        "deep_hours": round(deep_secs / 3600.0, 2),
                        "light_seconds": light_secs,
                        "light_hours": round(light_secs / 3600.0, 2),
                        "rem_seconds": rem_secs,
                        "rem_hours": round(rem_secs / 3600.0, 2),
                        "awake_seconds": awake_secs,
                        "awake_hours": round(awake_secs / 3600.0, 2),
                        "score": overall.get("value"),
                        "qualifier": overall.get("qualifierKey"),
                        "avg_hr": dto.get("avgHeartRate") or res.get("restingHeartRate"),
                        "avg_stress": dto.get("avgSleepStress"),
                        "avg_hrv": res.get("avgOvernightHrv"),
                        "hrv_status": res.get("hrvStatus"),
                        "body_battery_change": res.get("bodyBatteryChange"),
                        "avg_spo2": dto.get("averageSpO2Value"),
                        "avg_respiration": dto.get("averageRespirationValue"),
                        "start_time": dto.get("sleepStartTimestampLocal"),
                        "end_time": dto.get("sleepEndTimestampLocal"),
                    }
            except Exception:
                return None
            return None

        sleep_records = []
        with ThreadPoolExecutor(max_workers=6) as executor:
            fetched_sleep = list(executor.map(fetch_sleep_day, sleep_dates))
            sleep_records = [rec for rec in fetched_sleep if rec is not None]

        sleep_records.sort(key=lambda s: s["date"])

        # 8. Fitness Metrics History (VO2 Max, Resting HR & Fitness Age - 60 Days)
        from datetime import timedelta
        d60_str = (date.today() - timedelta(days=60)).isoformat()
        daily_vo2_map = {}
        latest_vo2_precise = None
        try:
            raw_maxmet = c.connectapi(f"/metrics-service/metrics/maxmet/daily/{d60_str}/{today_str}") or []
            for item in raw_maxmet:
                generic = item.get("generic") or {}
                c_date = generic.get("calendarDate")
                v_val = generic.get("vo2MaxPreciseValue") or generic.get("vo2MaxValue") or (item.get("cycling") or {}).get("vo2MaxPreciseValue")
                if c_date and v_val:
                    daily_vo2_map[c_date] = round(float(v_val), 1)
                    latest_vo2_precise = round(float(v_val), 1)
        except Exception:
            pass

        if latest_vo2_precise is not None:
            vo2max = latest_vo2_precise

        # Combine all unique dates from sleep records and VO2 max records
        all_metric_dates = sorted(list(set(sleep_dates + list(daily_vo2_map.keys()))))
        metrics_history = []
        sleep_rhr_map = {s["date"]: s.get("avg_hr") for s in sleep_records if s.get("avg_hr")}
        for dt_str in all_metric_dates:
            day_rhr = sleep_rhr_map.get(dt_str) or (rhr if dt_str == today_str else None)
            day_vo2 = daily_vo2_map.get(dt_str) or (vo2max if dt_str == today_str else None)

            day_fit_age = fitness_age
            if fitness_age and (day_vo2 is not None or day_rhr is not None):
                if dt_str == today_str:
                    day_fit_age = fitness_age
                else:
                    vo2_diff = (vo2max - day_vo2) if (vo2max and day_vo2) else 0
                    rhr_diff = (day_rhr - rhr) if (rhr and day_rhr) else 0
                    est_fit_age = fitness_age + (vo2_diff * 0.4) + (rhr_diff * 0.1)
                    day_fit_age = max(18.0, min(float(age or 60), round(est_fit_age, 1)))

            if day_rhr is not None or day_vo2 is not None or day_fit_age is not None:
                metrics_history.append({
                    "date": dt_str,
                    "vo2max": day_vo2,
                    "resting_hr": round(day_rhr) if day_rhr else None,
                    "fitness_age": round(day_fit_age, 1) if day_fit_age else None,
                })
        metrics_history.sort(key=lambda m: m["date"])

        payload = {
            "success": True,
            "data": {
                "age": age,
                "gender": gender,
                "height_cm": height_cm,
                "vo2max": vo2max,
                "resting_hr": rhr,
                "fitness_age": round(fitness_age, 1) if fitness_age else None,
                "fitness_age_components": fit_data.get("components") or {},
                "device": device,
                "prs": prs,
                "shoes": shoes,
                "daily_steps": daily_steps,
                "body_battery": body_battery,
                "sleep": sleep_records,
                "metrics_history": metrics_history,
                # Garmin 970+ new fields
                "training_readiness": training_readiness,
                "hrv_summary": hrv_summary,
                "race_predictions": race_predictions,
                "running_ftp": running_ftp,
                "training_load_balance": training_load_balance,
                "synced_at": datetime.now().isoformat(),
            }
        }
        print(json.dumps(payload, ensure_ascii=False))

    except Exception as e:
        sys.exit(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
