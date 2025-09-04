-- Allow all authenticated users to view purchase orders
CREATE POLICY "All authenticated users can view purchase orders" 
ON purchase_orders 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Allow engineers to view purchase orders assigned to them (more specific policy)
CREATE POLICY "Engineers can view their assigned purchase orders" 
ON purchase_orders 
FOR SELECT 
USING (
  engineer_id IN (
    SELECT id FROM engineers WHERE user_id = auth.uid()
  )
);