-- Auto-approve stock request delivery transactions
-- This trigger will automatically approve inventory transactions created from stock request deliveries

CREATE OR REPLACE FUNCTION auto_approve_stock_delivery_txns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Auto-approve transactions created from stock request deliveries
  IF NEW.reference LIKE '%Stock request delivery%' OR NEW.notes LIKE '%Delivered from stock request%' THEN
    NEW.status := 'approved';
    NEW.approved_by := NEW.created_by;
    NEW.approved_at := now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-approve stock delivery transactions
DROP TRIGGER IF EXISTS auto_approve_stock_deliveries ON inventory_txns;
CREATE TRIGGER auto_approve_stock_deliveries
  BEFORE INSERT ON inventory_txns
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_stock_delivery_txns();

-- Also approve existing pending stock delivery transactions
UPDATE inventory_txns 
SET 
  status = 'approved', 
  approved_by = created_by, 
  approved_at = now()
WHERE status = 'pending' 
AND (reference LIKE '%Stock request delivery%' OR notes LIKE '%Delivered from stock request%');