-- Remove the overly permissive purchase order policy
DROP POLICY "All authenticated users can view purchase orders" ON purchase_orders;

-- Fix charger inventory policy to restrict engineers to only their assigned chargers
DROP POLICY "Engineers can view charger inventory" ON charger_inventory;

-- Create proper charger inventory policy for engineers (only their assigned chargers)
CREATE POLICY "Engineers can view their assigned chargers" 
ON charger_inventory 
FOR SELECT 
USING (
  is_admin() OR 
  engineer_id IN (
    SELECT id FROM engineers WHERE user_id = auth.uid()
  )
);