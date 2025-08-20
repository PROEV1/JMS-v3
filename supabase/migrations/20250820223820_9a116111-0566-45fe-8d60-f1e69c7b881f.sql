-- Fix security definer view issue by replacing the view with a secure function

-- Drop the existing view
DROP VIEW IF EXISTS vw_item_location_balances;

-- Create a secure function that returns the same data with proper access controls
CREATE OR REPLACE FUNCTION get_item_location_balances()
RETURNS TABLE (
  item_id uuid,
  location_id uuid, 
  on_hand integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Only allow admins and managers to access inventory balances
  SELECT 
    t.item_id,
    t.location_id,
    COALESCE(sum(
      CASE
        WHEN t.direction = 'in' THEN t.qty
        WHEN t.direction = 'adjust' THEN t.qty  
        ELSE -t.qty
      END
    ), 0)::integer AS on_hand
  FROM inventory_txns t
  WHERE (
    -- Check if current user is admin or manager
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager') 
        AND status = 'active'
    )
  )
  GROUP BY t.item_id, t.location_id;
$$;

-- Add function comment
COMMENT ON FUNCTION get_item_location_balances() IS 
'Secure function to get inventory item balances by location. Access restricted to admins and managers.';

-- Grant execute permission to authenticated users (security is handled within the function)
GRANT EXECUTE ON FUNCTION get_item_location_balances() TO authenticated;