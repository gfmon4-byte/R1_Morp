-- SQL schema alteration to add columns for Garmin Profile, Gear, PRs, and Fitness Age
-- Run this in your Supabase SQL Editor if you want persistent storage of these fields!

ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS fitness_age NUMERIC(4,1);
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS fitness_age_data JSONB;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS garmin_prs JSONB;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS garmin_gear JSONB;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS garmin_device JSONB;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS garmin_daily_steps JSONB;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS garmin_body_battery JSONB;
ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS last_garmin_sync TIMESTAMPTZ;
