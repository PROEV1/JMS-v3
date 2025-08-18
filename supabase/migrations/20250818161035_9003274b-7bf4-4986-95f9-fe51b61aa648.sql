-- Fix the RLS policy for orders table to allow clients to create orders when accepting quotes
DROP POLICY IF EXISTS "Users can create orders for their clients" ON public.orders;

-- Create a more permissive policy that allows clients to create orders for themselves
CREATE POLICY "Users can create orders for their clients" ON public.orders
FOR INSERT
WITH CHECK (
  -- Allow admins to create any order
  is_admin() OR 
  -- Allow clients to create orders for themselves (direct client_id check)
  (client_id IN (
    SELECT c.id 
    FROM clients c 
    WHERE c.user_id = auth.uid()
  ))
);