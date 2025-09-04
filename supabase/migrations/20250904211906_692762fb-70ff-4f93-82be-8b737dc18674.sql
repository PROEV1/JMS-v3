-- Create profile record for the current admin user
INSERT INTO profiles (user_id, role, status, full_name)
VALUES (
  '225907b3-c4e9-4cd7-a65c-0d306572a9ce',
  'admin',
  'active', 
  'Darren Cope'
) ON CONFLICT (user_id) DO UPDATE SET
  role = 'admin',
  status = 'active',
  full_name = 'Darren Cope';