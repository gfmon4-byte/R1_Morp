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
  updated_at: string;
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
