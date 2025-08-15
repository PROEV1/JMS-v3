-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Engineers can view clients for their assigned orders" ON public.clients;
DROP POLICY IF EXISTS "Engineers can view quotes for their assigned orders" ON public.quotes;

-- Create security definer functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_engineer_assigned_client_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY_AGG(DISTINCT o.client_id)
  FROM orders o
  JOIN engineers e ON o.engineer_id = e.id
  WHERE e.user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_engineer_assigned_quote_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY_AGG(DISTINCT o.quote_id)
  FROM orders o
  JOIN engineers e ON o.engineer_id = e.id
  WHERE e.user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create new policies using the security definer functions
CREATE POLICY "Engineers can view clients for their assigned orders" 
ON public.clients 
FOR SELECT 
USING (id = ANY(get_engineer_assigned_client_ids()));

CREATE POLICY "Engineers can view quotes for their assigned orders"
ON public.quotes
FOR SELECT
USING (id = ANY(get_engineer_assigned_quote_ids()));