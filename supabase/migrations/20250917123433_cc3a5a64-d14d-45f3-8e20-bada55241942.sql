-- Reactivate the T-Shirts item that was deactivated
UPDATE inventory_items 
SET is_active = true, 
    updated_at = now()
WHERE name = 'T-Shirts' AND sku = 'T-Shirts';