-- Add scheduling rules to admin settings
INSERT INTO admin_settings (setting_key, setting_value) 
VALUES 
  ('scheduling_rules', '{
    "hours_advance_notice": 48,
    "max_distance_miles": 90,
    "max_jobs_per_day": 3,
    "working_hours_start": "08:00",
    "working_hours_end": "18:00"
  }'::jsonb),
  ('booking_rules', '{
    "allow_weekend_bookings": false,
    "allow_holiday_bookings": false,
    "require_client_confirmation": true
  }'::jsonb)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = now();

-- Create function to find first available slot for engineers
CREATE OR REPLACE FUNCTION public.find_first_available_slot(
  p_engineer_ids uuid[],
  p_client_postcode text,
  p_estimated_hours integer DEFAULT 2,
  p_client_id uuid DEFAULT NULL
)
RETURNS TABLE (
  engineer_id uuid,
  available_date date,
  distance_miles numeric,
  travel_time_minutes integer,
  recommendation_score numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  scheduling_config JSONB;
  min_notice_hours INTEGER;
  max_distance_miles INTEGER;
  max_jobs_per_day INTEGER;
  start_date DATE;
  check_date DATE;
  max_check_date DATE;
BEGIN
  -- Get scheduling configuration
  SELECT setting_value INTO scheduling_config
  FROM admin_settings
  WHERE setting_key = 'scheduling_rules';
  
  -- Extract configuration values
  min_notice_hours := COALESCE((scheduling_config->>'hours_advance_notice')::integer, 48);
  max_distance_miles := COALESCE((scheduling_config->>'max_distance_miles')::integer, 90);
  max_jobs_per_day := COALESCE((scheduling_config->>'max_jobs_per_day')::integer, 3);
  
  -- Calculate start date (minimum notice period)
  start_date := (now() + INTERVAL '1 hour' * min_notice_hours)::date;
  
  -- Maximum date to check (30 days from start)
  max_check_date := start_date + INTERVAL '30 days';
  
  -- Check each date until we find availability
  check_date := start_date;
  
  WHILE check_date <= max_check_date LOOP
    -- Return available engineers for this date
    RETURN QUERY
    SELECT 
      e.id as engineer_id,
      check_date as available_date,
      15.0::numeric as distance_miles, -- Placeholder for distance calculation
      20::integer as travel_time_minutes, -- Placeholder for travel time
      (100.0 - (15.0 * 0.5))::numeric as recommendation_score -- Simple scoring
    FROM engineers e
    WHERE e.id = ANY(p_engineer_ids)
      AND e.availability = true
      -- Check if engineer has less than max jobs on this date
      AND (
        SELECT COUNT(*)
        FROM orders o
        WHERE o.engineer_id = e.id
          AND o.scheduled_install_date::date = check_date
          AND o.status_enhanced NOT IN ('completed', 'cancelled')
      ) < max_jobs_per_day
      -- Check if engineer is not on time off
      AND NOT EXISTS (
        SELECT 1
        FROM engineer_time_off eto
        WHERE eto.engineer_id = e.id
          AND eto.status = 'approved'
          AND check_date BETWEEN eto.start_date AND eto.end_date
      )
      -- Skip weekends if not allowed
      AND (
        (scheduling_config->>'allow_weekend_bookings')::boolean = true
        OR EXTRACT(dow FROM check_date) NOT IN (0, 6)
      )
      -- Check if client hasn't blocked this date
      AND (
        p_client_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM client_blocked_dates cbd
          WHERE cbd.client_id = p_client_id
            AND cbd.blocked_date = check_date
        )
      );
    
    -- If we found any engineers for this date, we can exit
    IF FOUND THEN
      EXIT;
    END IF;
    
    -- Move to next day
    check_date := check_date + 1;
  END LOOP;
  
  RETURN;
END;
$function$;

-- Create function to get admin scheduling settings
CREATE OR REPLACE FUNCTION public.get_scheduling_settings()
RETURNS TABLE (
  hours_advance_notice integer,
  max_distance_miles integer,
  max_jobs_per_day integer,
  allow_weekend_bookings boolean,
  working_hours_start time,
  working_hours_end time
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    COALESCE((sr.setting_value->>'hours_advance_notice')::integer, 48) as hours_advance_notice,
    COALESCE((sr.setting_value->>'max_distance_miles')::integer, 90) as max_distance_miles,
    COALESCE((sr.setting_value->>'max_jobs_per_day')::integer, 3) as max_jobs_per_day,
    COALESCE((br.setting_value->>'allow_weekend_bookings')::boolean, false) as allow_weekend_bookings,
    COALESCE((sr.setting_value->>'working_hours_start')::time, '08:00'::time) as working_hours_start,
    COALESCE((sr.setting_value->>'working_hours_end')::time, '18:00'::time) as working_hours_end
  FROM 
    (SELECT setting_value FROM admin_settings WHERE setting_key = 'scheduling_rules') sr,
    (SELECT setting_value FROM admin_settings WHERE setting_key = 'booking_rules') br;
$function$;