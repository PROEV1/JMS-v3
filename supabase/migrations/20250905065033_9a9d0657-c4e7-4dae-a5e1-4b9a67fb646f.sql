-- Drop the existing function with embedded RLS logic
DROP FUNCTION IF EXISTS public.get_item_location_balances();

-- Create a simplified version without embedded RLS
CREATE OR REPLACE FUNCTION public.get_item_location_balances()
RETURNS TABLE (
  item_id uuid,
  location_id uuid,
  on_hand integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.item_id,
    t.location_id,
    COALESCE(SUM(
      CASE 
        WHEN t.direction = 'in' AND t.status = 'approved' THEN t.qty
        WHEN t.direction = 'out' AND t.status = 'approved' THEN -t.qty
        ELSE 0
      END
    ), 0)::integer as on_hand
  FROM inventory_txns t
  GROUP BY t.item_id, t.location_id
  HAVING COALESCE(SUM(
    CASE 
      WHEN t.direction = 'in' AND t.status = 'approved' THEN t.qty
      WHEN t.direction = 'out' AND t.status = 'approved' THEN -t.qty
      ELSE 0
    END
  ), 0) != 0;
END;
$$;

-- Update RLS policy on inventory_txns to allow engineers to view their van location transactions
DROP POLICY IF EXISTS "Engineers can view transactions for their van locations" ON inventory_txns;

CREATE POLICY "Engineers can view transactions for their van locations" 
ON inventory_txns 
FOR SELECT 
USING (
  is_admin() OR 
  is_manager() OR 
  (location_id IN (
    SELECT il.id
    FROM inventory_locations il
    JOIN engineers e ON il.engineer_id = e.id
    WHERE e.user_id = auth.uid() AND il.is_active = true
  ))
);

-- Also ensure engineers can view inventory items and locations they need
DROP POLICY IF EXISTS "Engineers can view all inventory items" ON inventory_items;

CREATE POLICY "Engineers can view all inventory items" 
ON inventory_items 
FOR SELECT 
USING (
  is_admin() OR 
  is_manager() OR 
  EXISTS (SELECT 1 FROM engineers WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Engineers can view all active locations" ON inventory_locations;

CREATE POLICY "Engineers can view all active locations" 
ON inventory_locations 
FOR SELECT 
USING (
  is_admin() OR 
  is_manager() OR 
  (is_active = true AND (
    engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid()) OR
    type = 'warehouse'
  ))
);