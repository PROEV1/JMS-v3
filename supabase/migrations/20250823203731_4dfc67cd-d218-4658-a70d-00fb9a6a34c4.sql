-- Remove duplicate partner_users records for pconstable@gmx.com
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.partner_users 
  WHERE user_id = 'c0573782-efa5-474d-a96f-0191b4c3bc4c'
)
DELETE FROM public.partner_users 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);