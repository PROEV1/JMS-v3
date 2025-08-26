-- Update the archived inventory item to be active again for testing
UPDATE inventory_items 
SET is_active = true 
WHERE id = '60dd8d38-af94-4360-81e5-f34e57c92dc0';