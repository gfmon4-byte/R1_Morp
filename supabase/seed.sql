-- Sample seed data for first run
-- Run after migrations: psql or Supabase SQL editor

INSERT INTO profiles (
  name, gender, birth_date, vo2max, vt2_percent,
  weight_kg, height_cm,
  pb_5k, pb_10k, pb_half, pb_marathon,
  hr_max, hr_rest,
  pace_zone_1_min, pace_zone_1_max,
  pace_zone_2_min, pace_zone_2_max,
  pace_zone_3_min, pace_zone_3_max,
  pace_zone_4_min, pace_zone_4_max,
  pace_zone_5_min, pace_zone_5_max
) VALUES (
  'Alex Runner', 'Male', '1992-03-15', 72.5, 87.0,
  62.0, 178.0,
  '15:42', '32:18', '1:11:05', '2:32:40',
  192, 48,
  '6:30', '6:50',
  '5:45', '6:10',
  '5:10', '5:35',
  '4:40', '5:05',
  '4:10', '4:35'
);

INSERT INTO activities (date, session_type, distance_km, duration_seconds, avg_pace_sec_per_km, avg_hr, max_hr, hr_zone_breakdown, elevation_gain_m, rpe, notes, route_name) VALUES
  ('2026-06-28', 'Easy Run', 12.5, 4200, 336, 132, 148, '{"z1":5,"z2":55,"z3":10,"z4":0,"z5":0}', 85, 4, 'Felt smooth, legs fresh after rest day.', 'Lumpini Loop'),
  ('2026-06-26', 'Tempo', 10.0, 2820, 282, 165, 178, '{"z1":5,"z2":10,"z3":15,"z4":22,"z5":0}', 42, 7, '3x2km @ threshold with 2min jog recovery.', 'Track Session'),
  ('2026-06-24', 'Long Run', 22.0, 8580, 390, 145, 162, '{"z1":10,"z2":120,"z3":13,"z4":0,"z5":0}', 210, 6, 'Progression last 5km. Hot morning.', 'River Path'),
  ('2026-06-22', 'Intervals', 8.5, 2400, 282, 172, 189, '{"z1":8,"z2":12,"z3":5,"z4":10,"z5":5}', 15, 8, '6x800m @ 2:50 with 400m jog.', 'Track Session'),
  ('2026-06-20', 'Recovery Run', 6.0, 2520, 420, 118, 132, '{"z1":38,"z2":4,"z3":0,"z4":0,"z5":0}', 20, 2, 'Very easy shakeout.', 'Neighborhood'),
  ('2026-06-18', 'Easy Run', 14.0, 5040, 360, 138, 152, '{"z1":8,"z2":70,"z3":6,"z4":0,"z5":0}', 95, 4, NULL, 'Park Circuit'),
  ('2026-06-15', 'Race', 10.0, 1920, 192, 178, 192, '{"z1":2,"z2":5,"z3":8,"z4":15,"z5":5}', 55, 9, '10K time trial — new PB effort.', 'City 10K');

INSERT INTO training_plan (date, day_of_week, phase, session_type, description, distance_km, pace_target, hr_zone, rpe, notes, completed) VALUES
  ('2026-06-30', 'Monday', 'Build', 'Easy Run', 'Aerobic maintenance run', 12.0, '5:45-6:10/km', 'Z2', 4, NULL, false),
  ('2026-07-01', 'Tuesday', 'Build', 'Intervals', '6x800m @ 5K pace, 400m jog recovery', 8.5, '4:10-4:35/km', 'Z4-Z5', 8, 'Track or flat road', false),
  ('2026-07-02', 'Wednesday', 'Build', 'Recovery Run', 'Very easy shakeout', 6.0, '6:30-7:00/km', 'Z1', 2, NULL, false),
  ('2026-07-03', 'Thursday', 'Build', 'Tempo', '20min continuous @ threshold', 10.0, '4:40-5:05/km', 'Z4', 7, NULL, false),
  ('2026-07-04', 'Friday', 'Build', 'Rest', 'Complete rest or light mobility', 0, '-', '-', NULL, 'Foam roll 15min', false),
  ('2026-07-05', 'Saturday', 'Build', 'Long Run', 'Progressive long run — last 5km moderate', 22.0, '5:45-6:30/km', 'Z2-Z3', 6, 'Bring hydration', false),
  ('2026-07-06', 'Sunday', 'Build', 'Easy Run', 'Recovery jog', 8.0, '6:00-6:30/km', 'Z2', 3, NULL, false);
