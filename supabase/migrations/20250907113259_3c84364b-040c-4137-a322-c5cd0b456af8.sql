-- Fix parameter type for get_engineer_daily_workload_with_holds function call
CREATE OR REPLACE FUNCTION public.accept_job_offer_transaction(
  p_offer_id UUID,
  p_order_id UUID,
  p_engineer_id UUID,
  p_time_window TEXT,
  p_response_time TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offered_date DATE;
  v_current_workload INTEGER;
  v_max_jobs_per_day INTEGER;
  v_is_subcontractor BOOLEAN;
  v_engineer_max_jobs INTEGER;
  v_admin_max_jobs INTEGER;
  v_order_number TEXT;
  v_engineer_name TEXT;
BEGIN
  -- Get offer details
  SELECT offered_date::date
  INTO v_offered_date
  FROM job_offers
  WHERE id = p_offer_id;

  -- Get engineer details
  SELECT is_subcontractor, max_installs_per_day, name
  INTO v_is_subcontractor, v_engineer_max_jobs, v_engineer_name
  FROM engineers
  WHERE id = p_engineer_id;

  -- Get current workload for the date (fix parameter type)
  SELECT get_engineer_daily_workload_with_holds(p_engineer_id, v_offered_date)
  INTO v_current_workload;

  -- Get max jobs per day limit
  IF v_is_subcontractor THEN
    v_max_jobs_per_day := COALESCE(v_engineer_max_jobs, 5);
  ELSE
    -- Get admin setting
    SELECT (setting_value->>'max_jobs_per_day')::integer
    INTO v_admin_max_jobs
    FROM admin_settings
    WHERE setting_key = 'scheduling_config';
    
    v_max_jobs_per_day := COALESCE(v_engineer_max_jobs, v_admin_max_jobs, 3);
  END IF;

  -- Check capacity
  IF (COALESCE(v_current_workload, 0) + 1) > v_max_jobs_per_day THEN
    RAISE EXCEPTION 'Engineer is now at capacity (% / % jobs). Please try scheduling for a different date.', 
      COALESCE(v_current_workload, 0), v_max_jobs_per_day;
  END IF;

  -- Update offer status
  UPDATE job_offers
  SET status = 'accepted',
      accepted_at = p_response_time::timestamptz
  WHERE id = p_offer_id
    AND status = 'pending'; -- Ensure it's still pending

  -- Check if update affected any rows
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer is no longer available or has already been responded to';
  END IF;

  -- Update order
  UPDATE orders
  SET engineer_id = p_engineer_id,
      time_window = p_time_window,
      manual_status_override = false,
      manual_status_notes = null
  WHERE id = p_order_id;

  -- Get order number for logging
  SELECT order_number INTO v_order_number FROM orders WHERE id = p_order_id;

  -- Log activity
  PERFORM log_order_activity(
    p_order_id,
    'offer_accepted',
    format('Client accepted installation offer for %s with %s - Ready to book', 
           v_offered_date::text, v_engineer_name),
    jsonb_build_object(
      'offer_id', p_offer_id,
      'engineer_id', p_engineer_id,
      'offered_date', v_offered_date,
      'time_window', p_time_window,
      'accepted_at', p_response_time
    )
  );

END;
$$;