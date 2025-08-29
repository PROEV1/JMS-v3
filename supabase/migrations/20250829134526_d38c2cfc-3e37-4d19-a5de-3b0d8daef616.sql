-- Simple test - try to update directly to 'received'
UPDATE stock_requests 
SET status = 'received', 
    notes = 'Test: Direct update to received status to see if it works',
    updated_at = now()
WHERE id = 'c8cd3443-9771-4853-a4b4-d492894964fc'
RETURNING id, status, notes;

-- Also check what the current data type is for status column
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'stock_requests' AND column_name = 'status';