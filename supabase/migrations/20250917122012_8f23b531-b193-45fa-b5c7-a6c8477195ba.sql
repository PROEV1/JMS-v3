-- Create or replace the get_item_location_balances function to handle 'adjust' direction
CREATE OR REPLACE FUNCTION public.get_item_location_balances(location_uuid uuid DEFAULT NULL)
RETURNS TABLE(
  item_id uuid,
  location_id uuid,
  current_stock integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    t.item_id,
    t.location_id,
    COALESCE(
      SUM(
        CASE 
          WHEN t.direction = 'in' THEN t.qty
          WHEN t.direction = 'out' THEN -t.qty
          WHEN t.direction = 'adjust' THEN t.qty  -- Handle adjust direction
          ELSE 0
        END
      )::integer, 
      0
    ) as current_stock
  FROM public.inventory_txns t
  WHERE t.status = 'approved'
    AND (location_uuid IS NULL OR t.location_id = location_uuid)
  GROUP BY t.item_id, t.location_id
  HAVING SUM(
    CASE 
      WHEN t.direction = 'in' THEN t.qty
      WHEN t.direction = 'out' THEN -t.qty
      WHEN t.direction = 'adjust' THEN t.qty  -- Handle adjust direction
      ELSE 0
    END
  ) != 0;
END;
$function$