
-- Remove any client records for pconstable@gmx.com
DELETE FROM public.clients 
WHERE email = 'pconstable@gmx.com';

-- Also remove any associated user profile that might be causing conflicts
DELETE FROM public.profiles 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'pconstable@gmx.com'
) AND role = 'client';
