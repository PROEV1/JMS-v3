-- Add RLS policy to allow partner users to view their own partner information
CREATE POLICY "Partner users can view their own partner details" 
ON public.partners 
FOR SELECT 
USING (
  id IN (
    SELECT partner_id 
    FROM partner_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);