-- ============================================================
-- Elite Running App - Seed Data
-- Run AFTER schema.sql
-- ============================================================

-- ---- Profile (elite male runner defaults) ----
INSERT INTO profiles (
  id, name, gender, birth_date, vo2max, vt2_percent,
  weight_kg, height_cm,
  pb_5k, pb_10k, pb_half, pb_marathon,
  hr_max, hr_rest, pace_zone_mode
) VALUES (
  1, 'Morp', 'male', '1990-03-15', 72.0, 85.0,
  62.0, 172.0,
  1080,    -- 18:00 for 5k
  2310,    -- 38:30 for 10k
  5100,    -- 1:25:00 for half
  11400    -- 3:10:00 for marathon
  185, 42, 'auto'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  vo2max = EXCLUDED.vo2max,
  hr_max = EXCLUDED.hr_max,
  hr_rest = EXCLUDED.hr_rest;

-- ---- Sample activities (last 3 weeks) ----
INSERT INTO activities (date, session_type, distance_km, duration_seconds, avg_pace_sec_per_km, avg_hr, max_hr, elevation_gain_m, rpe, notes, route_name) VALUES
  ('2026-06-20', 'Easy Run',     8.0,  3360,  420, 148, 162, 45,  4, 'Morning easy run', 'Park Loop'),
  ('2026-06-22', 'Long Run',    14.0,  6300,  450, 152, 168, 88,  5, 'Steady long run', 'River Route'),
  ('2026-06-24', 'Intervals',    8.2,  2952,  360, 168, 182, 30,  8, '6x400m @4:40', 'Track'),
  ('2026-06-25', 'Recovery Run', 5.0,  2400,  480, 135, 148, 20,  2, 'Very easy recovery', 'Neighborhood'),
  ('2026-06-27', 'Tempo',        8.0,  2640,  330, 165, 178, 35,  7, '4km threshold @5:00/km', 'Road'),
  ('2026-06-28', 'Easy Run',     7.0,  3150,  450, 145, 160, 40,  3, 'Easy aerobic', 'Park Loop'),
  ('2026-06-30', 'Long Run',    12.0,  5400,  450, 150, 165, 70,  5, 'Long slow distance', 'River Route'),
  ('2026-07-01', 'Easy Run',     6.0,  2700,  450, 142, 158, 30,  3, 'Morning run', 'Neighborhood');

-- ---- Seed training plan from CSV (sample rows) ----
INSERT INTO training_plan (date, day_of_week, phase, session_type, description, distance_km, pace_target, hr_zone, rpe, notes) VALUES
  ('2026-07-01','Wed','Base','Rest','Busy Day',0,'-','-',NULL,'No Training'),
  ('2026-07-02','Thu','Base','Strength A','Bulgarian Split Squat 3x8; Single-leg RDL 3x8; Hip Thrust 3x10',0,'-','-','7','Heavy Strength'),
  ('2026-07-03','Fri','Base','Easy Run','5 km Easy',5,'6:45-7:10/km','Z2','3','Conversational Pace'),
  ('2026-07-04','Sat','Base','Mobility','Foam Roll + Hip Mobility + Stretch',0,'-','-','1','Recovery'),
  ('2026-07-07','Tue','Base','Easy Run','6 km Easy',6,'6:45-7:10/km','Z2','3','Relaxed'),
  ('2026-07-10','Fri','Base','Easy Run','6 km Easy',6,'6:40-7:05/km','Z2','3',''),
  ('2026-07-11','Sat','Base','Long Run','8 km Easy',8,'6:45-7:10/km','Z2','4',''),
  ('2026-07-18','Sat','Base','Long Run','10 km Easy',10,'6:40-7:05/km','Z2','4',''),
  ('2026-07-25','Sat','Base','Long Run','12 km Easy',12,'6:35-7:00/km','Z2','5','Fuel practice')
ON CONFLICT (date) DO NOTHING;
