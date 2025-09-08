-- Fix duration discrepancy by adding estimated_duration_hours to get_date_offered_orders function
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
  estimated_duration_hours integer,
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
SET search_path = public
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
    o.estimated_duration_hours,
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