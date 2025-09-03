-- Fix the admin_settings RLS policy to use the correct admin check function
DROP POLICY IF EXISTS "Admins can manage settings" ON public.admin_settings;

CREATE POLICY "Admins can manage settings" 
ON public.admin_settings 
FOR ALL 
TO public
USING (public.is_admin());

-- Also add proper insert policy with check condition
DROP POLICY IF EXISTS "Admin insert policy" ON public.admin_settings;

CREATE POLICY "Admin insert policy" 
ON public.admin_settings 
FOR INSERT 
TO public
WITH CHECK (public.is_admin());