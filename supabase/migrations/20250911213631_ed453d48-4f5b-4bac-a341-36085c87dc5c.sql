-- Create function to search orders for charger assignment (bypasses RLS)
CREATE OR REPLACE FUNCTION public.search_orders_for_charger_assignment(search_postcode text)
RETURNS TABLE(
  id uuid,
  order_number text,
  scheduled_install_date timestamptz,
  status_enhanced order_status_enhanced,
  client_id uuid,
  engineer_id uuid,
  client_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return orders that match the postcode search, regardless of RLS
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.scheduled_install_date,
    o.status_enhanced,
    o.client_id,
    o.engineer_id,
    jsonb_build_object(
      'full_name', c.full_name,
      'address', c.address,
      'postcode', c.postcode,
      'phone', c.phone
    ) as client_data
  FROM public.orders o
  LEFT JOIN public.clients c ON o.client_id = c.id
  WHERE (
    LOWER(c.postcode) LIKE '%' || LOWER(search_postcode) || '%' OR
    LOWER(c.address) LIKE '%' || LOWER(search_postcode) || '%' OR
    LOWER(REPLACE(c.postcode, ' ', '')) LIKE '%' || LOWER(REPLACE(search_postcode, ' ', '')) || '%'
  )
  ORDER BY o.created_at DESC
  LIMIT 100;
END;
$$;