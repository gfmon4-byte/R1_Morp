-- Migration: Create garmin_tokens table for persistent token storage on Vercel
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql

CREATE TABLE IF NOT EXISTS garmin_tokens (
  id          integer PRIMARY KEY DEFAULT 1,
  tokens_json jsonb   NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Only ever allow 1 row (single user app)
ALTER TABLE garmin_tokens ADD CONSTRAINT garmin_tokens_single_row CHECK (id = 1);

-- Disable RLS (server-side only, accessed via service role key)
ALTER TABLE garmin_tokens DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE garmin_tokens IS 'Stores Garmin Connect OAuth tokens for server-side use only.';
