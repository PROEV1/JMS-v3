-- Create some low stock scenarios for testing
-- Set reorder points higher than current stock for some items
UPDATE inventory_items 
SET reorder_point = 50
WHERE id IN (
  SELECT id FROM inventory_items 
  WHERE is_active = true 
  LIMIT 1
);