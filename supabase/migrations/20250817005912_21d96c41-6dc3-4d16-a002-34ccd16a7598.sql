-- Drop all problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Engineers can view clients for assigned orders" ON public.clients;
DROP POLICY IF EXISTS "Engineers can view quotes for assigned orders" ON public.quotes;

-- Create comprehensive security definer functions
CREATE OR REPLACE FUNCTION public.user_has_role(role_name user_role)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = role_name 
    AND status = 'active'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_can_view_client(client_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    -- User is admin
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND status = 'active'
  ) OR EXISTS (
    -- User owns this client
    SELECT 1 FROM public.clients c
    WHERE c.id = client_uuid 
    AND c.user_id = auth.uid()
  ) OR EXISTS (
    -- User is engineer assigned to orders for this client
    SELECT 1 FROM public.orders o
    JOIN public.engineers e ON e.id = o.engineer_id
    WHERE o.client_id = client_uuid 
    AND e.user_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Recreate the engineer policies with better logic
CREATE POLICY "Engineers can view clients for assigned orders" 
ON public.clients 
FOR SELECT 
USING (public.user_can_view_client(id));

CREATE POLICY "Engineers can view quotes for assigned orders" 
ON public.quotes 
FOR SELECT 
USING (
  public.user_has_role('admin'::user_role) OR
  client_id IN (
    SELECT clients.id FROM clients WHERE clients.user_id = auth.uid()
  ) OR
  id IN (
    SELECT DISTINCT q.id FROM quotes q
    JOIN orders o ON o.quote_id = q.id
    JOIN engineers e ON e.id = o.engineer_id
    WHERE e.user_id = auth.uid()
  )
);