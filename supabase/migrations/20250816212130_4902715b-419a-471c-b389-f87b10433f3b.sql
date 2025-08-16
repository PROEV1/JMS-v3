-- Fix existing engineer profiles that were incorrectly created with 'client' role
UPDATE profiles 
SET role = 'engineer'::user_role 
WHERE email IN ('eng1@example.com', 'eng2@example.com') 
  AND role = 'client'::user_role;