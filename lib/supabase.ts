import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single shared client for browser usage
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types matching the database schema
export interface Profile {
  id: number;
  name: string;
  gender: 'male' | 'female' | 'other' | null;
  birth_date: string | null;
  vo2max: number | null;
  vt2_percent: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  pb_5k: number | null;
  pb_10k: number | null;
  pb_half: number | null;
  pb_marathon: number | null;
  hr_max: number;
  hr_rest: number;
  pace_zone_mode: 'auto' | 'manual';
  pace_zone_1_min: string | null;
  pace_zone_1_max: string | null;
  pace_zone_2_min: string | null;
  pace_zone_2_max: string | null;
  pace_zone_3_min: string | null;
  pace_zone_3_max: string | null;
  pace_zone_4_min: string | null;
  pace_zone_4_max: string | null;
  pace_zone_5_min: string | null;
  pace_zone_5_max: string | null;
  races: Race[] | null;
  inbody_weight: number | null;
  inbody_smm: number | null;
  inbody_bfm: number | null;
  inbody_tbw: number | null;
  inbody_protein: number | null;
  inbody_mineral: number | null;
  inbody_date: string | null;
  fitness_age?: number | null;
  fitness_age_data?: {
    sleep?: GarminSleepRecord[];
    fr970?: any;
    [key: string]: any;
  } | null;
  garmin_device?: any;
  garmin_prs?: any;
  garmin_gear?: any;
  garmin_daily_steps?: any;
  garmin_body_battery?: any;
  last_garmin_sync?: string | null;
  updated_at: string;
}

export interface GarminSleepRecord {
  date: string;
  duration_seconds: number;
  duration_hours: number;
  deep_seconds: number;
  deep_hours: number;
  light_seconds: number;
  light_hours: number;
  rem_seconds: number;
  rem_hours: number;
  awake_seconds: number;
  awake_hours: number;
  score?: number | null;
  qualifier?: string | null;
  avg_hr?: number | null;
  avg_stress?: number | null;
  avg_hrv?: number | null;
  hrv_status?: string | null;
  body_battery_change?: number | null;
  avg_spo2?: number | null;
  avg_respiration?: number | null;
  start_time?: number | string | null;
  end_time?: number | string | null;
}

export interface Race {
  id: string;
  name: string;
  date: string;
  distance?: '5k' | '10k' | 'Half' | 'Full' | string;
}

export interface Activity {
  id: string;
  date: string;
  session_type: string;
  distance_km: number;
  duration_seconds: number;
  avg_pace_sec_per_km: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  hr_zone_breakdown: Record<string, number> | null;
  elevation_gain_m: number;
  rpe: number | null;
  notes: string | null;
  route_name: string | null;
  garmin_activity_id?: string | null;
  title?: string | null;
  activity_type?: string | null;
  calories?: number | null;
  avg_cadence?: number | null;
  max_cadence?: number | null;
  avg_stride_length?: number | null;
  avg_vertical_oscillation?: number | null;
  avg_vertical_ratio?: number | null;
  avg_ground_contact_time?: number | null;
  steps?: number | null;
  body_battery_drain?: number | null;
  run_type?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingPlan {
  id: string;
  date: string;
  day_of_week: string | null;
  phase: string | null;
  session_type: string | null;
  description: string | null;
  distance_km: number | null;
  pace_target: string | null;
  hr_zone: string | null;
  rpe: string | null;
  notes: string | null;
  completed: boolean;
  linked_activity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InBodyHistory {
  id: string;
  date: string;
  weight: number | null;
  smm: number | null;
  bfm: number | null;
  tbw: number | null;
  protein: number | null;
  mineral: number | null;
  created_at: string;
}

export interface ActivityDetailLap {
  lap_index?: number;
  part_name?: string;
  part_index?: number;
  part_label?: string;
  distance_km?: number;
  distance_meters?: number;
  duration_seconds?: number;
  moving_duration_seconds?: number;
  duration_formatted?: string;
  moving_duration_formatted?: string;
  avg_hr?: number;
  max_hr?: number;
  avg_pace?: string;
  avg_speed_kph?: number;
  avg_cadence?: number;
  max_cadence?: number;
  calories?: number;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
  avg_stride_length_m?: number;
  avg_ground_contact_time_ms?: number;
  avg_vertical_ratio_percent?: number;
  avg_vertical_oscillation_cm?: number;
  [key: string]: any;
}

export interface ActivityDetail {
  activity_id: string;
  session_date: string;
  details: {
    laps?: ActivityDetailLap[];
    hr_zones?: Array<{
      zone_number: number;
      zone_name?: string;
      seconds_in_zone?: number;
      percentage?: number;
      min_bpm?: number;
      duration_formatted?: string;
      [key: string]: any;
    }>;
    summary?: Record<string, any>;
    gear?: Record<string, any>;
    weather?: Record<string, any>;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
}

