-- Update existing pending PO amendment transactions to approved status
UPDATE inventory_txns 
SET 
  status = 'approved',
  approved_by = created_by,
  approved_at = now()
WHERE reference ILIKE '%PO Amendment%' 
  AND status = 'pending';