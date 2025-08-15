-- Check current RLS policies for clients table
-- and update them to allow admins to create clients for other users

-- Drop existing policies and recreate them with proper admin permissions
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can update their own data" ON public.clients;
DROP POLICY IF EXISTS "Clients can view their own data" ON public.clients;

-- Create updated policies that properly handle admin operations
CREATE POLICY "Admins can manage all clients" 
ON public.clients 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role)
WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Clients can view their own data" 
ON public.clients 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Clients can update their own data" 
ON public.clients 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);