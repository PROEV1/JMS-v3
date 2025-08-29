-- Add RLS policy to allow engineers to create stock adjustments for their own van locations
CREATE POLICY "Engineers can create stock adjustments for their van locations" 
ON public.inventory_txns 
FOR INSERT 
WITH CHECK (
  location_id IN (
    SELECT il.id 
    FROM inventory_locations il 
    JOIN engineers e ON il.engineer_id = e.id 
    WHERE e.user_id = auth.uid()
  )
);