-- Update ready to book count to include both awaiting_install_booking and date_accepted statuses
CREATE OR REPLACE FUNCTION public.get_schedule_status_counts_v2()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  result jsonb := '{}';
  needs_scheduling_count integer;
  date_offered_count integer;
  ready_to_book_count integer;
  scheduled_today_count integer;
  scheduled_count integer;
  completion_pending_count integer;
  completed_count integer;
  cancelled_count integer;
  on_hold_count integer;
  unavailable_engineers_count integer;
  today date := CURRENT_DATE;
  now_ts timestamp with time zone := now();
BEGIN
  -- Get date offered count (orders with active pending offers)
  SELECT COUNT(DISTINCT o.id)::integer INTO date_offered_count
  FROM orders o
  INNER JOIN job_offers jo ON jo.order_id = o.id
  WHERE o.status_enhanced = 'date_offered'
    AND o.scheduling_suppressed = false
    AND jo.status = 'pending'
    AND jo.expires_at > now_ts;

  -- Get needs scheduling count (awaiting_install_booking without active offers)
  SELECT COUNT(*)::integer INTO needs_scheduling_count
  FROM orders o
  WHERE o.status_enhanced = 'awaiting_install_booking'
    AND o.scheduling_suppressed = false
    AND NOT EXISTS (
      SELECT 1 FROM job_offers jo 
      WHERE jo.order_id = o.id 
        AND jo.status IN ('pending', 'accepted')
        AND (jo.status != 'pending' OR jo.expires_at > now_ts)
    );

  -- Get ready to book count (orders with accepted offers, not yet scheduled)
  -- Include both awaiting_install_booking and date_accepted statuses
  SELECT COUNT(DISTINCT o.id)::integer INTO ready_to_book_count
  FROM orders o
  INNER JOIN job_offers jo ON jo.order_id = o.id
  WHERE o.status_enhanced IN ('awaiting_install_booking', 'date_accepted')
    AND o.scheduling_suppressed = false
    AND o.scheduled_install_date IS NULL
    AND jo.status = 'accepted';

  -- Get scheduled today count
  SELECT COUNT(*)::integer INTO scheduled_today_count
  FROM orders
  WHERE status_enhanced = 'scheduled'
    AND scheduled_install_date::date = today;

  -- Get remaining counts
  SELECT COUNT(*)::integer INTO scheduled_count
  FROM orders 
  WHERE status_enhanced = 'scheduled' AND scheduling_suppressed = false;

  SELECT COUNT(*)::integer INTO completion_pending_count
  FROM orders 
  WHERE status_enhanced = 'install_completed_pending_qa';

  SELECT COUNT(*)::integer INTO completed_count
  FROM orders 
  WHERE status_enhanced = 'completed';

  SELECT COUNT(*)::integer INTO cancelled_count
  FROM orders 
  WHERE status_enhanced = 'cancelled';

  SELECT COUNT(*)::integer INTO on_hold_count
  FROM orders 
  WHERE status_enhanced = 'on_hold_parts_docs';

  SELECT COUNT(*)::integer INTO unavailable_engineers_count
  FROM engineers 
  WHERE availability = false;

  -- Build result object
  result := jsonb_build_object(
    'needsScheduling', needs_scheduling_count,
    'dateOffered', date_offered_count,
    'readyToBook', ready_to_book_count,
    'scheduledToday', scheduled_today_count,
    'scheduled', scheduled_count,
    'completionPending', completion_pending_count,
    'completed', completed_count,
    'cancelled', cancelled_count,
    'onHold', on_hold_count,
    'unavailableEngineers', unavailable_engineers_count
  );

  RETURN result;
END;
$function$;