-- Temporarily make one of the existing users an admin for testing
UPDATE public.profiles 
SET role = 'admin'::user_role, 
    updated_at = now()
WHERE user_id = '665a945e-5f53-4489-a3fc-d91769fe1809'
AND role = 'client';