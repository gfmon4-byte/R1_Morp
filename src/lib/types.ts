export type HRZoneBreakdown = {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
};

export type Profile = {
  id: string;
  name: string;
  gender: string;
  birth_date: string | null;
  vo2max: number | null;
  vt2_percent: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  pb_5k: string | null;
  pb_10k: string | null;
  pb_half: string | null;
  pb_marathon: string | null;
  hr_max: number | null;
  hr_rest: number | null;
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
  updated_at: string;
};

export type Activity = {
  id: string;
  date: string;
  session_type: string;
  distance_km: number | null;
  duration_seconds: number;
  avg_pace_sec_per_km: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  hr_zone_breakdown: HRZoneBreakdown | null;
  elevation_gain_m: number | null;
  rpe: number | null;
  notes: string | null;
  route_name: string | null;
  created_at: string;
};

export type TrainingPlanEntry = {
  id: string;
  date: string;
  day_of_week: string | null;
  phase: string | null;
  session_type: string;
  description: string | null;
  distance_km: number | null;
  pace_target: string | null;
  hr_zone: string | null;
  rpe: number | null;
  notes: string | null;
  completed: boolean;
  linked_activity_id: string | null;
  created_at: string;
};

export type DateRangeFilter = "week" | "month" | "90days" | "all";

export type HRZonePeriod = "7" | "30" | "90";
