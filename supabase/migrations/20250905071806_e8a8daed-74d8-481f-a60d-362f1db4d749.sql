-- Add RLS policies for returns_rma_lines table

-- Enable RLS on returns_rma_lines if not already enabled
ALTER TABLE returns_rma_lines ENABLE ROW LEVEL SECURITY;

-- Allow engineers to create RMA line items
CREATE POLICY "Engineers can create RMA line items" 
ON returns_rma_lines 
FOR INSERT 
WITH CHECK (
  EXISTS ( 
    SELECT 1
    FROM engineers
    WHERE user_id = auth.uid()
  )
);

-- Allow admins to manage all RMA line items
CREATE POLICY "Admins can manage all RMA line items" 
ON returns_rma_lines 
FOR ALL 
USING (is_admin());

-- Allow engineers to view RMA line items they created (through the main RMA)
CREATE POLICY "Engineers can view RMA line items they created" 
ON returns_rma_lines 
FOR SELECT 
USING (
  is_admin() OR 
  EXISTS (
    SELECT 1 
    FROM returns_rmas r
    WHERE r.id = returns_rma_lines.rma_id 
    AND r.created_by = auth.uid()
  )
);