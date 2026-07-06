-- ============================================================
-- Elite Running App - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ---- profiles (single row, user's personal data) ----
CREATE TABLE IF NOT EXISTS profiles (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL DEFAULT 'Runner',
  gender               TEXT CHECK (gender IN ('male','female','other')),
  birth_date           DATE,
  vo2max               NUMERIC(5,2),
  vt2_percent          NUMERIC(5,2) DEFAULT 85,
  weight_kg            NUMERIC(5,2),
  height_cm            NUMERIC(5,2),
  pb_5k                INTEGER,          -- seconds
  pb_10k               INTEGER,          -- seconds
  pb_half              INTEGER,          -- seconds
  pb_marathon          INTEGER,          -- seconds
  hr_max               INTEGER DEFAULT 185,
  hr_rest              INTEGER DEFAULT 42,
  pace_zone_mode       TEXT NOT NULL DEFAULT 'auto' CHECK (pace_zone_mode IN ('auto','manual')),
  -- manual pace zones (stored as "MM:SS" strings)
  pace_zone_1_min      TEXT,
  pace_zone_1_max      TEXT,
  pace_zone_2_min      TEXT,
  pace_zone_2_max      TEXT,
  pace_zone_3_min      TEXT,
  pace_zone_3_max      TEXT,
  pace_zone_4_min      TEXT,
  pace_zone_4_max      TEXT,
  pace_zone_5_min      TEXT,
  pace_zone_5_max      TEXT,
  races                JSONB DEFAULT '[]'::jsonb,
  inbody_weight        NUMERIC(5,2),
  inbody_smm           NUMERIC(5,2),
  inbody_bfm           NUMERIC(5,2),
  inbody_tbw           NUMERIC(5,2),
  inbody_protein       NUMERIC(5,2),
  inbody_mineral       NUMERIC(5,2),
  inbody_date          DATE,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ---- activities (manual log entries) ----
CREATE TABLE IF NOT EXISTS activities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  DATE NOT NULL,
  session_type          TEXT NOT NULL DEFAULT 'Easy Run',
  distance_km           NUMERIC(6,3) DEFAULT 0,
  duration_seconds      INTEGER DEFAULT 0,
  avg_pace_sec_per_km   INTEGER,
  avg_hr                INTEGER,
  max_hr                INTEGER,
  hr_zone_breakdown     JSONB DEFAULT '{}',
  elevation_gain_m      INTEGER DEFAULT 0,
  rpe                   INTEGER CHECK (rpe BETWEEN 1 AND 10),
  notes                 TEXT,
  route_name            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activities_date_idx ON activities (date DESC);
CREATE INDEX IF NOT EXISTS activities_session_type_idx ON activities (session_type);

-- ---- training_plan (CSV import, upsert on date) ----
CREATE TABLE IF NOT EXISTS training_plan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE NOT NULL UNIQUE,
  day_of_week         TEXT,
  phase               TEXT,
  session_type        TEXT,
  description         TEXT,
  distance_km         NUMERIC(6,3),
  pace_target         TEXT,
  hr_zone             TEXT,
  rpe                 TEXT,
  notes               TEXT,
  completed           BOOLEAN DEFAULT FALSE,
  linked_activity_id  UUID REFERENCES activities(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS training_plan_date_idx ON training_plan (date);

-- ---- inbody_history (body composition logs over time) ----
CREATE TABLE IF NOT EXISTS inbody_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL UNIQUE,
  weight       NUMERIC(5,2),
  smm          NUMERIC(5,2),
  bfm          NUMERIC(5,2),
  tbw          NUMERIC(5,2),
  protein      NUMERIC(5,2),
  mineral      NUMERIC(5,2),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Disable RLS (single-user app) ----
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_plan DISABLE ROW LEVEL SECURITY;
ALTER TABLE inbody_history DISABLE ROW LEVEL SECURITY;
