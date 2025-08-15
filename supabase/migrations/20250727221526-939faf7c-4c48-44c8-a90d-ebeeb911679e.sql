-- Add RLS policy for engineers to view their assigned orders
CREATE POLICY "Engineers can view their assigned orders" 
ON public.orders 
FOR SELECT 
USING (engineer_id IN (
  SELECT id FROM engineers WHERE user_id = auth.uid()
));