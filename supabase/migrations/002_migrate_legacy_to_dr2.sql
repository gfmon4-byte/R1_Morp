-- Migrate from legacy dr schema to dr2 schema.
-- Safe to run in Supabase SQL Editor. Renames old tables, then creates dr2 tables.
-- Old data is kept in *_legacy tables.

-- Legacy training_plan used plan_date instead of date
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'training_plan'
      AND column_name = 'plan_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'training_plan'
      AND column_name = 'date'
  ) THEN
    ALTER TABLE public.training_plan RENAME TO training_plan_legacy;
  END IF;
END $$;

-- Legacy activities used activity_type / distance instead of session_type / distance_km
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'activity_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'session_type'
  ) THEN
    ALTER TABLE public.activities RENAME TO activities_legacy;
  END IF;
END $$;

-- dr2 schema (same as 001_initial_schema.sql)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  birth_date DATE,
  vo2max NUMERIC,
  vt2_percent NUMERIC,
  weight_kg NUMERIC,
  height_cm NUMERIC,
  pb_5k TEXT,
  pb_10k TEXT,
  pb_half TEXT,
  pb_marathon TEXT,
  hr_max INTEGER,
  hr_rest INTEGER,
  pace_zone_1_min TEXT,
  pace_zone_1_max TEXT,
  pace_zone_2_min TEXT,
  pace_zone_2_max TEXT,
  pace_zone_3_min TEXT,
  pace_zone_3_max TEXT,
  pace_zone_4_min TEXT,
  pace_zone_4_max TEXT,
  pace_zone_5_min TEXT,
  pace_zone_5_max TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  session_type TEXT NOT NULL,
  distance_km NUMERIC,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  avg_pace_sec_per_km INTEGER,
  avg_hr INTEGER,
  max_hr INTEGER,
  hr_zone_breakdown JSONB,
  elevation_gain_m NUMERIC,
  rpe INTEGER CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  notes TEXT,
  route_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_date_idx ON activities (date DESC);
CREATE INDEX IF NOT EXISTS activities_session_type_idx ON activities (session_type);

CREATE TABLE IF NOT EXISTS training_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  day_of_week TEXT,
  phase TEXT,
  session_type TEXT NOT NULL,
  description TEXT,
  distance_km NUMERIC,
  pace_target TEXT,
  hr_zone TEXT,
  rpe INTEGER CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  linked_activity_id UUID REFERENCES activities (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_plan_date_idx ON training_plan (date);
CREATE INDEX IF NOT EXISTS training_plan_phase_idx ON training_plan (phase);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_plan ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow all profiles'
  ) THEN
    CREATE POLICY "Allow all profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activities' AND policyname = 'Allow all activities'
  ) THEN
    CREATE POLICY "Allow all activities" ON activities FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'training_plan' AND policyname = 'Allow all training_plan'
  ) THEN
    CREATE POLICY "Allow all training_plan" ON training_plan FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Reload PostgREST schema cache so the app sees new tables immediately
NOTIFY pgrst, 'reload schema';
