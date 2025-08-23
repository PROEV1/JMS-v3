-- Remove duplicate partner_users records, keeping only one
DELETE FROM public.partner_users 
WHERE user_id = 'c0573782-efa5-474d-a96f-0191b4c3bc4c' 
AND id NOT IN (
  SELECT MIN(id) 
  FROM public.partner_users 
  WHERE user_id = 'c0573782-efa5-474d-a96f-0191b4c3bc4c'
);