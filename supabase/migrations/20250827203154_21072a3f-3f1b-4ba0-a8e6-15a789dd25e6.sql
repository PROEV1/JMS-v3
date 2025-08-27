-- Create admin profile for the current user
INSERT INTO public.profiles (user_id, email, full_name, role, status)
VALUES (
  '22590723-c4e9-4cd7-a65c-0d306572a9ce',
  'darren.cope@proev.co.uk',
  'Darren Cope',
  'admin',
  'active'
)
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'admin',
  status = 'active',
  updated_at = now();