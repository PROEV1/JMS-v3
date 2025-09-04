-- Fix the get_item_location_balances function to allow engineers to see their van stock
-- and only count approved transactions
CREATE OR REPLACE FUNCTION public.get_item_location_balances()
RETURNS TABLE(item_id uuid, location_id uuid, on_hand integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- Only count approved transactions
    t.status = 'approved'
  ) AND (
    -- Allow admins and managers to see all balances
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager') 
        AND status = 'active'
    )
    OR
    -- Allow engineers to see balances for their own van locations
    EXISTS (
      SELECT 1 FROM inventory_locations il
      JOIN engineers e ON il.engineer_id = e.id
      WHERE il.id = t.location_id
        AND e.user_id = auth.uid()
        AND il.is_active = true
    )
  )
  GROUP BY t.item_id, t.location_id;
$function$