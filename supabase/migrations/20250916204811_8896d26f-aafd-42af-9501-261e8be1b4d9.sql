-- Fix the accept_job_offer_transaction function to exclude current offer from capacity calculation
CREATE OR REPLACE FUNCTION public.accept_job_offer_transaction(
  p_offer_id uuid,
  p_order_id uuid,
  p_engineer_id uuid,
  p_time_window text,
  p_response_time text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_confirmed_jobs INTEGER;
  v_other_pending_offers INTEGER;
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

  -- CRITICAL FIX: Calculate capacity excluding the current offer being accepted
  -- Count confirmed jobs (scheduled orders) for this date
  SELECT COUNT(*)::INT INTO v_confirmed_jobs
  FROM orders
  WHERE engineer_id = p_engineer_id
    AND scheduled_install_date::date = v_offered_date
    AND status_enhanced NOT IN ('completed', 'cancelled');

  -- Count OTHER pending offers (excluding this one being accepted)
  SELECT COUNT(*)::INT INTO v_other_pending_offers
  FROM job_offers jo
  LEFT JOIN orders o ON jo.order_id = o.id
  WHERE jo.engineer_id = p_engineer_id
    AND jo.offered_date::date = v_offered_date
    AND jo.id != p_offer_id  -- EXCLUDE the current offer
    AND jo.status = 'pending'
    AND jo.expires_at > now()
    AND (o.scheduled_install_date IS NULL OR o.scheduled_install_date::date != v_offered_date);

  -- Total current workload (confirmed + other pending, excluding current offer)
  v_current_workload := v_confirmed_jobs + v_other_pending_offers;

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

  -- Check capacity (now correctly excludes current offer)
  IF (v_current_workload + 1) > v_max_jobs_per_day THEN
    RAISE EXCEPTION 'Engineer % is at capacity (% + 1 would exceed % jobs). Please try a different date or engineer.', 
      v_engineer_name, v_current_workload, v_max_jobs_per_day;
  END IF;

  -- Add detailed logging for debugging
  RAISE LOG 'Accepting offer: Engineer=% Date=% ConfirmedJobs=% OtherPendingOffers=% Total=% Max=% OfferID=%', 
    v_engineer_name, v_offered_date, v_confirmed_jobs, v_other_pending_offers, v_current_workload, v_max_jobs_per_day, p_offer_id;

  -- Update offer status atomically
  UPDATE job_offers
  SET status = 'accepted',
      accepted_at = p_response_time::timestamptz,
      updated_at = now()
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
      manual_status_notes = null,
      updated_at = now()
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
      'accepted_at', p_response_time,
      'capacity_check', jsonb_build_object(
        'confirmed_jobs', v_confirmed_jobs,
        'other_pending_offers', v_other_pending_offers,
        'total_workload', v_current_workload,
        'max_jobs', v_max_jobs_per_day
      )
    )
  );

  RAISE LOG 'Offer % accepted successfully for order %', p_offer_id, v_order_number;

END;
$$;