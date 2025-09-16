-- Fix Accept button issue by adding job offer engineer_id to get_date_offered_orders RPC
DROP FUNCTION IF EXISTS public.get_date_offered_orders(integer, integer);

CREATE OR REPLACE FUNCTION public.get_date_offered_orders(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS TABLE(
  id uuid,
  order_number text,
  client_id uuid,
  engineer_id uuid,
  scheduled_install_date date,
  status_enhanced order_status_enhanced,
  created_at timestamp with time zone,
  estimated_duration_hours numeric,
  job_type text,
  client_full_name text,
  client_email text,
  client_phone text,
  client_postcode text,
  client_address text,
  engineer_name text,
  partner_name text,
  offer_id uuid,
  offer_engineer_id uuid,
  offer_expires_at timestamp with time zone,
  offer_offered_date timestamp with time zone,
  offer_time_window text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.client_id,
    o.engineer_id,
    o.scheduled_install_date::date,
    o.status_enhanced,
    o.created_at,
    o.estimated_duration_hours,
    o.job_type::text,
    c.full_name as client_full_name,
    c.email as client_email,
    c.phone as client_phone,
    c.postcode as client_postcode,
    c.address as client_address,
    e.name as engineer_name,
    p.name as partner_name,
    jo.id as offer_id,
    jo.engineer_id as offer_engineer_id,
    jo.expires_at as offer_expires_at,
    jo.offered_date as offer_offered_date,
    jo.time_window as offer_time_window
  FROM orders o
  INNER JOIN job_offers jo ON jo.order_id = o.id
  LEFT JOIN clients c ON c.id = o.client_id
  LEFT JOIN engineers e ON e.id = o.engineer_id
  LEFT JOIN partners p ON p.id = o.partner_id
  WHERE o.scheduling_suppressed = false
    AND jo.status = 'pending'
    AND jo.expires_at > now()
  ORDER BY jo.expires_at ASC, o.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;