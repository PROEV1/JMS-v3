-- Add RLS policy to allow engineers to update their assigned orders
CREATE POLICY "Engineers can update their assigned orders" 
ON public.orders 
FOR UPDATE 
USING (engineer_id IN (
  SELECT engineers.id
  FROM engineers
  WHERE engineers.user_id = auth.uid()
))
WITH CHECK (engineer_id IN (
  SELECT engineers.id
  FROM engineers
  WHERE engineers.user_id = auth.uid()
));