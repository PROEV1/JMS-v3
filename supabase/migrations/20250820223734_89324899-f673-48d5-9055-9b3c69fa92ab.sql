-- Fix security definer view issue by enabling RLS on the view and adding policies

-- Enable RLS on the inventory balances view
ALTER TABLE vw_item_location_balances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the view that match the underlying table's security model
-- Admins can view all inventory balances
CREATE POLICY "Admins can view inventory balances" 
ON vw_item_location_balances 
FOR SELECT 
USING (is_admin());

-- Managers can view inventory balances  
CREATE POLICY "Managers can view inventory balances" 
ON vw_item_location_balances 
FOR SELECT 
USING (is_manager());

-- Add a comment explaining the security model
COMMENT ON VIEW vw_item_location_balances IS 
'View showing inventory item balances by location. Access restricted to admins and managers via RLS policies.';