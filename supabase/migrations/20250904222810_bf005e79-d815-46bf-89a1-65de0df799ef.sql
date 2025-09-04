-- Fix the calculate_po_totals function to work with generated line_total column
CREATE OR REPLACE FUNCTION calculate_po_totals(p_po_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Since line_total is a generated column (quantity * unit_cost), 
  -- we don't need to update it - it updates automatically.
  -- We only need to update the PO total_amount by summing the auto-calculated line_totals
  
  UPDATE purchase_orders
  SET total_amount = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM purchase_order_lines
    WHERE purchase_order_id = p_po_id
  ),
  updated_at = now()
  WHERE id = p_po_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;