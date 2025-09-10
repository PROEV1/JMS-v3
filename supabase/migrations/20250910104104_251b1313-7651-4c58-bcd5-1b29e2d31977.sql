-- Update Lee Tyler's role from client to standard_office_user
UPDATE profiles 
SET role = 'standard_office_user'
WHERE user_id = '6812ce6d-bdad-4895-a520-aa3922c063e7' 
  AND email = 'lee@proev.co.uk';