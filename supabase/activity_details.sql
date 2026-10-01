-- ==============================================================================
-- Activity Details Table for Deep Workout Analytics (WU + Main Set + CD, Laps, Dynamics)
-- ==============================================================================

-- 1. Create table for deep running details
CREATE TABLE IF NOT EXISTS public.activity_details (
  activity_id TEXT PRIMARY KEY,
  session_date DATE NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create index for fast date lookup
CREATE INDEX IF NOT EXISTS idx_activity_details_date ON public.activity_details (session_date);

-- 3. Enable Row Level Security (RLS) & set permissions
ALTER TABLE public.activity_details ENABLE ROW LEVEL SECURITY;

-- Allow read access for public / authenticated
CREATE POLICY "Allow public read on activity_details" 
  ON public.activity_details FOR SELECT USING (true);

-- Allow insert/update/delete for authenticated / service role
CREATE POLICY "Allow full access on activity_details" 
  ON public.activity_details FOR ALL USING (true);
