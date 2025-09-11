-- Update ben.hugh@proev.co.uk from client to admin role
UPDATE profiles 
SET role = 'admin'::user_role, 
    updated_at = now()
WHERE user_id = 'b6a2a806-d731-464e-90fc-0df82bbcfcd8';