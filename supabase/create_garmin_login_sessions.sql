-- SQL Migration: Create garmin_login_sessions table for MFA session storage across serverless functions
-- Run this in your Supabase SQL Editor!

CREATE TABLE IF NOT EXISTS garmin_login_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- Index on expires_at for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_garmin_login_sessions_expires_at ON garmin_login_sessions(expires_at);

-- Row Level Security (RLS) Configuration
ALTER TABLE garmin_login_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public access (or service role) for session creation and verification
CREATE POLICY "Allow select on garmin_login_sessions" ON garmin_login_sessions FOR SELECT USING (true);
CREATE POLICY "Allow insert on garmin_login_sessions" ON garmin_login_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow delete on garmin_login_sessions" ON garmin_login_sessions FOR DELETE USING (true);

COMMENT ON TABLE garmin_login_sessions IS 'Temporary storage for Garmin MFA login session state (TTL: 5 minutes). Contains cookies and session context, never user passwords.';
