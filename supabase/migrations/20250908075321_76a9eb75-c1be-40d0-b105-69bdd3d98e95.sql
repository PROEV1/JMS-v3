-- Performance optimization: Add essential indexes
CREATE INDEX IF NOT EXISTS idx_job_offers_order_id_status_expires 
ON job_offers (order_id, status, expires_at) 
WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_job_offers_status_expires_active 
ON job_offers (status, expires_at) 
WHERE status = 'pending' AND expires_at > now();

CREATE INDEX IF NOT EXISTS idx_orders_status_enhanced_scheduling 
ON orders (status_enhanced, scheduling_suppressed) 
WHERE scheduling_suppressed = false;

CREATE INDEX IF NOT EXISTS idx_orders_scheduled_date_status 
ON orders (scheduled_install_date, status_enhanced) 
WHERE scheduled_install_date IS NOT NULL;

-- Performance optimization: Single RPC for all status counts
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
  tomorrow date := CURRENT_DATE + 1;
BEGIN
  -- Get needs scheduling count (awaiting_install_booking without offers)
  SELECT COUNT(*)::integer INTO needs_scheduling_count
  FROM orders o
  WHERE o.status_enhanced = 'awaiting_install_booking'
    AND o.scheduling_suppressed = false
    AND NOT EXISTS (
      SELECT 1 FROM job_offers jo 
      WHERE jo.order_id = o.id 
        AND jo.status IN ('pending', 'accepted')
        AND (jo.status != 'pending' OR jo.expires_at > now())
    );

  -- Get date offered count (orders with active pending offers)
  SELECT COUNT(DISTINCT o.id)::integer INTO date_offered_count
  FROM orders o
  INNER JOIN job_offers jo ON jo.order_id = o.id
  WHERE o.status_enhanced = 'date_offered'
    AND o.scheduling_suppressed = false
    AND jo.status = 'pending'
    AND jo.expires_at > now();

  -- Get ready to book count (orders with accepted offers, not yet scheduled)
  SELECT COUNT(DISTINCT o.id)::integer INTO ready_to_book_count
  FROM orders o
  INNER JOIN job_offers jo ON jo.order_id = o.id
  WHERE o.status_enhanced = 'awaiting_install_booking'
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

-- Performance optimization: Single RPC for date offered orders
CREATE OR REPLACE FUNCTION public.get_date_offered_orders(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  order_number text,
  client_id uuid,
  engineer_id uuid,
  scheduled_install_date date,
  status_enhanced order_status_enhanced,
  created_at timestamp with time zone,
  client_full_name text,
  client_email text,
  client_phone text,
  engineer_name text,
  partner_name text,
  offer_id uuid,
  offer_expires_at timestamp with time zone,
  offer_offered_date timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.client_id,
    o.engineer_id,
    o.scheduled_install_date,
    o.status_enhanced,
    o.created_at,
    c.full_name as client_full_name,
    c.email as client_email,
    c.phone as client_phone,
    e.name as engineer_name,
    p.name as partner_name,
    jo.id as offer_id,
    jo.expires_at as offer_expires_at,
    jo.offered_date as offer_offered_date
  FROM orders o
  INNER JOIN job_offers jo ON jo.order_id = o.id
  LEFT JOIN clients c ON c.id = o.client_id
  LEFT JOIN engineers e ON e.id = o.engineer_id
  LEFT JOIN partners p ON p.id = o.partner_id
  WHERE o.status_enhanced = 'date_offered'
    AND o.scheduling_suppressed = false
    AND jo.status = 'pending'
    AND jo.expires_at > now()
  ORDER BY jo.expires_at ASC, o.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;