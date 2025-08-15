-- Add INSERT policy for orders table to allow clients to create orders for themselves
CREATE POLICY "Clients can create their own orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (client_id IN ( 
  SELECT clients.id 
  FROM clients 
  WHERE clients.user_id = auth.uid()
));