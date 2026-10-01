-- ==============================================================================
-- Garmin Integration Setup for R1_Morp (Supabase SQL)
-- Run this script in the Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ==============================================================================

-- 1. Create garmin_tokens table (stores OAuth2 tokens for serverless and Python sync)
CREATE TABLE IF NOT EXISTS public.garmin_tokens (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  tokens_json JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only 1 row can exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'garmin_tokens_single_row'
  ) THEN
    ALTER TABLE public.garmin_tokens ADD CONSTRAINT garmin_tokens_single_row CHECK (id = 1);
  END IF;
END $$;

-- Disable RLS on garmin_tokens (accessed via backend / service role key)
ALTER TABLE public.garmin_tokens DISABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.garmin_tokens IS 'Stores Garmin Connect OAuth tokens.';


-- 2. Create garmin_login_sessions table (for 2FA/MFA login state)
CREATE TABLE IF NOT EXISTS public.garmin_login_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX IF NOT EXISTS idx_garmin_login_sessions_expires_at 
  ON public.garmin_login_sessions(expires_at);

ALTER TABLE public.garmin_login_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow select on garmin_login_sessions" ON public.garmin_login_sessions;
  CREATE POLICY "Allow select on garmin_login_sessions" ON public.garmin_login_sessions FOR SELECT USING (true);
  
  DROP POLICY IF EXISTS "Allow insert on garmin_login_sessions" ON public.garmin_login_sessions;
  CREATE POLICY "Allow insert on garmin_login_sessions" ON public.garmin_login_sessions FOR INSERT WITH CHECK (true);
  
  DROP POLICY IF EXISTS "Allow delete on garmin_login_sessions" ON public.garmin_login_sessions;
  CREATE POLICY "Allow delete on garmin_login_sessions" ON public.garmin_login_sessions FOR DELETE USING (true);
END $$;


-- 3. Create activity_details table (stores workout laps, splits & deep dynamics)
CREATE TABLE IF NOT EXISTS public.activity_details (
  activity_id TEXT PRIMARY KEY,
  session_date DATE NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activity_details_date 
  ON public.activity_details(session_date);

ALTER TABLE public.activity_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow public read on activity_details" ON public.activity_details;
  CREATE POLICY "Allow public read on activity_details" ON public.activity_details FOR SELECT USING (true);
  
  DROP POLICY IF EXISTS "Allow full access on activity_details" ON public.activity_details;
  CREATE POLICY "Allow full access on activity_details" ON public.activity_details FOR ALL USING (true);
END $$;


-- 4. Add Garmin fields to existing activities table
ALTER TABLE public.activities 
  ADD COLUMN IF NOT EXISTS garmin_activity_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS activity_type TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS calories INTEGER,
  ADD COLUMN IF NOT EXISTS avg_cadence INTEGER,
  ADD COLUMN IF NOT EXISTS max_cadence INTEGER,
  ADD COLUMN IF NOT EXISTS avg_stride_length NUMERIC(4, 2),
  ADD COLUMN IF NOT EXISTS avg_vertical_oscillation NUMERIC(4, 1),
  ADD COLUMN IF NOT EXISTS avg_vertical_ratio NUMERIC(4, 1),
  ADD COLUMN IF NOT EXISTS avg_ground_contact_time INTEGER,
  ADD COLUMN IF NOT EXISTS steps INTEGER,
  ADD COLUMN IF NOT EXISTS body_battery_drain INTEGER,
  ADD COLUMN IF NOT EXISTS run_type TEXT;

CREATE INDEX IF NOT EXISTS idx_activities_garmin_id 
  ON public.activities(garmin_activity_id);


-- 5. Add Garmin metrics to existing profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fitness_age NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS fitness_age_data JSONB,
  ADD COLUMN IF NOT EXISTS garmin_prs JSONB,
  ADD COLUMN IF NOT EXISTS garmin_gear JSONB,
  ADD COLUMN IF NOT EXISTS garmin_device JSONB,
  ADD COLUMN IF NOT EXISTS garmin_daily_steps JSONB,
  ADD COLUMN IF NOT EXISTS garmin_body_battery JSONB,
  ADD COLUMN IF NOT EXISTS last_garmin_sync TIMESTAMPTZ;


-- 6. Create user_profile view for backwards compatibility with garmin_mon scripts
CREATE OR REPLACE VIEW public.user_profile AS 
  SELECT * FROM public.profiles;

