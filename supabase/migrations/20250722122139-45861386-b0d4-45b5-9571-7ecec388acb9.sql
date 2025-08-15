-- Fix the RLS policies to ensure admins can properly create clients
-- The issue might be with the policy conditions

-- Drop and recreate the admin policy with more explicit conditions
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;

-- Create a more permissive admin policy that explicitly allows INSERT
CREATE POLICY "Admins can manage all clients" 
ON public.clients 
FOR ALL 
TO authenticated
USING (
    -- Allow admins to see/update all clients
    get_user_role(auth.uid()) = 'admin'::user_role
)
WITH CHECK (
    -- Allow admins to create clients for any user
    get_user_role(auth.uid()) = 'admin'::user_role
);

-- Also ensure the get_user_role function is working correctly
-- Let's check if there are any issues with the function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE profiles.user_id = get_user_role.user_id;
$$;