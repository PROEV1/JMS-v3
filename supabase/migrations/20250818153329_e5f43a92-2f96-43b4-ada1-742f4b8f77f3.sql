-- Add INSERT policy for quotes table to allow admins and users to create quotes for their clients
CREATE POLICY "Admins can create quotes" ON quotes 
FOR INSERT 
WITH CHECK (
  is_admin() OR 
  user_owns_client(client_id, auth.uid())
);