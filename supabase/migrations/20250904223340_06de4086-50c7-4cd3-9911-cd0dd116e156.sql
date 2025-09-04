-- Update the stock adjustment function to create approved transactions for PO amendments
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
  
  -- Create inventory transaction with APPROVED status for PO amendments
  -- These are automatic adjustments based on confirmed order changes
  INSERT INTO inventory_txns (
    item_id,
    location_id,
    direction,
    qty,
    reference,
    notes,
    status,
    approved_by,
    approved_at,
    created_by
  ) VALUES (
    p_item_id,
    p_location_id,
    v_direction,
    v_qty,
    COALESCE(p_reference, 'PO Amendment: ' || p_po_id),
    'Stock adjustment due to PO amendment. Quantity change: ' || p_quantity_change,
    'approved', -- Auto-approved for PO amendments
    auth.uid(), -- Auto-approved by the user making the amendment
    now(),
    auth.uid()
  ) RETURNING id INTO v_txn_id;
  
  RETURN v_txn_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;