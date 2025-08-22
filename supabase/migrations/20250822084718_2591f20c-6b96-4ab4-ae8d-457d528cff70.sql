-- Fix the orders INSERT policy to allow partner job inserts
DROP POLICY IF EXISTS "Users can create orders for their clients" ON orders;

-- Create new policy that allows partner job inserts with service role
CREATE POLICY "Users can create orders for their clients" ON orders
FOR INSERT 
WITH CHECK (
  -- Admin users can insert any order
  is_admin() 
  OR 
  -- Users can insert orders for their clients (regular flow)
  (client_id IN (SELECT c.id FROM clients c WHERE c.user_id = auth.uid()))
  OR
  -- Service role can insert partner jobs (even without client_id)
  (is_partner_job IS TRUE AND auth.role() = 'service_role')
);