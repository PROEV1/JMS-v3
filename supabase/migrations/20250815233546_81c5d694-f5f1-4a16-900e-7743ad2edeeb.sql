-- Update existing user pconstable@gmx.com to be a client
-- First, update their profile role to 'client'
UPDATE public.profiles 
SET role = 'client'
WHERE email = 'pconstable@gmx.com';

-- Create a client record for this user if one doesn't exist
INSERT INTO public.clients (user_id, full_name, email, created_at, updated_at)
SELECT 
  p.user_id,
  p.full_name,
  p.email,
  now(),
  now()
FROM public.profiles p
WHERE p.email = 'pconstable@gmx.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.user_id = p.user_id
  );