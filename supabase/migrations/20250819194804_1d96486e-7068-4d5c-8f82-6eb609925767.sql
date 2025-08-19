-- Fix missing profile for paul@proev.co.uk admin user
INSERT INTO public.profiles (user_id, email, full_name, role, status, created_at, updated_at)
VALUES (
  '3e21f03a-7676-42dd-b1ba-7683b0091a0f',
  'paul@proev.co.uk', 
  'Paul (Admin)',
  'admin',
  'active',
  now(),
  now()
);