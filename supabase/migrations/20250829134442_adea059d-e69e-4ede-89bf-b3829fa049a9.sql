-- Test if we can update a stock request to 'received' status
-- First, let's check what enum values exist
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'stock_request_status') ORDER BY enumlabel;

-- Now let's try to manually update one of the cancelled records to received to test
UPDATE stock_requests 
SET status = 'received'::stock_request_status, 
    notes = 'Test: Manual update to received status',
    updated_at = now()
WHERE id = 'c8cd3443-9771-4853-a4b4-d492894964fc'
RETURNING id, status, notes;