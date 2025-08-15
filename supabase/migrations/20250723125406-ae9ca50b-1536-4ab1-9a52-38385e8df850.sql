-- Make user_id nullable in clients table to allow clients without user accounts
ALTER TABLE public.clients ALTER COLUMN user_id DROP NOT NULL;

-- Add a new RLS policy to allow admins to create clients without user accounts
CREATE POLICY "Admins can create clients without users" 
ON public.clients 
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);