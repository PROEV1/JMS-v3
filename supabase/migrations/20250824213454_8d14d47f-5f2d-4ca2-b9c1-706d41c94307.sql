-- Remove manual override from the order so it uses standard logic
UPDATE orders 
SET manual_status_override = false,
    manual_status_notes = NULL
WHERE id = '4f3b0f14-9f37-4e9c-882d-f556f5b052a8';

-- Trigger the status calculation to refresh based on current logic
UPDATE orders 
SET updated_at = now()
WHERE id = '4f3b0f14-9f37-4e9c-882d-f556f5b052a8';