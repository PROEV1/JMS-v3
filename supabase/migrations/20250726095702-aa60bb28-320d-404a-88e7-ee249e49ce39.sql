-- Check and fix admin user role
UPDATE profiles 
SET role = 'admin', status = 'active' 
WHERE email = 'paul@proev.co.uk';