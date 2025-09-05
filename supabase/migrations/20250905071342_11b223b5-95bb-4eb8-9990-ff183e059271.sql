-- Add INSERT policy for engineers to create RMAs
CREATE POLICY "Engineers can create RMAs for returns" 
ON returns_rmas 
FOR INSERT 
WITH CHECK (
  -- Allow engineers to create RMAs
  (EXISTS ( 
    SELECT 1
    FROM engineers
    WHERE user_id = auth.uid()
  )) AND
  -- Ensure they set themselves as the creator
  created_by = auth.uid()
);