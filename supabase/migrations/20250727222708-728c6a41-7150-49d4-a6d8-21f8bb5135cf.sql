-- Fix search path for security definer functions
CREATE OR REPLACE FUNCTION public.get_engineer_assigned_client_ids()
RETURNS uuid[] 
LANGUAGE SQL 
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT o.client_id)
  FROM orders o
  JOIN engineers e ON o.engineer_id = e.id
  WHERE e.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_engineer_assigned_quote_ids()
RETURNS uuid[] 
LANGUAGE SQL 
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT o.quote_id)
  FROM orders o
  JOIN engineers e ON o.engineer_id = e.id
  WHERE e.user_id = auth.uid();
$$;