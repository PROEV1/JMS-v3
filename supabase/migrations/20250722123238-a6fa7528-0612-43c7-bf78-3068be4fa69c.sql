-- Update the clients table RLS policy to allow service role operations
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;

CREATE POLICY "Admins can manage all clients" 
ON public.clients 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role OR auth.role() = 'service_role') 
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role OR auth.role() = 'service_role');