-- Function to calculate PO line and total amounts
CREATE OR REPLACE FUNCTION calculate_po_totals(p_po_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Update line totals (quantity × unit_cost)
  UPDATE purchase_order_lines 
  SET line_total = quantity * unit_cost
  WHERE purchase_order_id = p_po_id;
  
  -- Update PO total amount (sum of all line totals)
  UPDATE purchase_orders
  SET total_amount = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM purchase_order_lines
    WHERE purchase_order_id = p_po_id
  ),
  updated_at = now()
  WHERE id = p_po_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get engineer's van location ID
CREATE OR REPLACE FUNCTION get_engineer_van_location(p_engineer_id UUID)
RETURNS UUID AS $$
DECLARE
  v_location_id UUID;
BEGIN
  SELECT id INTO v_location_id
  FROM inventory_locations
  WHERE engineer_id = p_engineer_id 
    AND type = 'van' 
    AND is_active = true
  LIMIT 1;
  
  RETURN v_location_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to create stock adjustment transaction
CREATE OR REPLACE FUNCTION create_stock_adjustment_for_po_amendment(
  p_item_id UUID,
  p_location_id UUID,
  p_quantity_change INTEGER,
  p_po_id UUID,
  p_reference TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_txn_id UUID;
  v_direction TEXT;
  v_qty INTEGER;
BEGIN
  -- Skip if no quantity change
  IF p_quantity_change = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Determine direction and quantity
  IF p_quantity_change > 0 THEN
    v_direction := 'in';
    v_qty := p_quantity_change;
  ELSE
    v_direction := 'out';
    v_qty := ABS(p_quantity_change);
  END IF;
  
  -- Create inventory transaction
  INSERT INTO inventory_txns (
    item_id,
    location_id,
    direction,
    qty,
    reference,
    notes,
    status,
    created_by
  ) VALUES (
    p_item_id,
    p_location_id,
    v_direction,
    v_qty,
    COALESCE(p_reference, 'PO Amendment: ' || p_po_id),
    'Stock adjustment due to PO amendment. Quantity change: ' || p_quantity_change,
    'pending',
    auth.uid()
  ) RETURNING id INTO v_txn_id;
  
  RETURN v_txn_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;