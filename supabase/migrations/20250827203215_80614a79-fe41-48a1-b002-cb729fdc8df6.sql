-- First check what profiles exist and create a sample admin user
-- Insert a profile with admin role for testing
INSERT INTO public.profiles (user_id, email, full_name, role, status, created_at, updated_at)
SELECT 
  '22590723-c4e9-4cd7-a65c-0d306572a9ce'::uuid,
  'darren.cope@proev.co.uk',
  'Darren Cope', 
  'admin'::user_role,
  'active',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE user_id = '22590723-c4e9-4cd7-a65c-0d306572a9ce'::uuid
);