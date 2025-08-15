-- Create scheduling settings in admin_settings table
INSERT INTO admin_settings (setting_key, setting_value) VALUES 
('scheduling_rules', '{
  "minimum_advance_hours": 48,
  "max_distance_miles": 50,
  "max_jobs_per_day": 3,
  "working_hours_start": "09:00",
  "working_hours_end": "17:00"
}'::jsonb) 
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

INSERT INTO admin_settings (setting_key, setting_value) VALUES 
('booking_rules', '{
  "allow_weekend_bookings": false,
  "allow_holiday_bookings": false,
  "require_client_confirmation": true
}'::jsonb) 
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = now();