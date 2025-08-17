-- Temporarily disable the policies that might be causing recursion
DROP POLICY IF EXISTS "Engineers can view clients for assigned orders" ON public.clients;
DROP POLICY IF EXISTS "Engineers can view quotes for assigned orders" ON public.quotes;

-- Create simpler, non-recursive policies for engineers
CREATE POLICY "Engineers can view assigned clients" 
ON public.clients 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND (
    -- User is admin
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin' 
      AND status = 'active'
    ) OR
    -- User owns this client
    user_id = auth.uid() OR
    -- User is engineer assigned to orders for this client - using direct join
    id IN (
      SELECT DISTINCT o.client_id 
      FROM public.orders o, public.engineers e
      WHERE o.engineer_id = e.id 
      AND e.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Engineers can view assigned quotes" 
ON public.quotes 
FOR SELECT 
USING (
  auth.role() = 'authenticated' AND (
    -- User is admin
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin' 
      AND status = 'active'
    ) OR
    -- User owns this client
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    ) OR
    -- User is engineer assigned to orders for this quote - using direct join
    id IN (
      SELECT DISTINCT o.quote_id 
      FROM public.orders o, public.engineers e
      WHERE o.engineer_id = e.id 
      AND e.user_id = auth.uid()
    )
  )
);