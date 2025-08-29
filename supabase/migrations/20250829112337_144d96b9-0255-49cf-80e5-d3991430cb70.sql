-- Add RLS policy to allow engineers to view inventory transactions for their own van locations
CREATE POLICY "Engineers can view transactions for their van locations" 
ON public.inventory_txns 
FOR SELECT 
USING (
  location_id IN (
    SELECT il.id 
    FROM inventory_locations il 
    JOIN engineers e ON il.engineer_id = e.id 
    WHERE e.user_id = auth.uid()
  )
);