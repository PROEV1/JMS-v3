-- Simple approach: Just add 'received' as a valid status value
-- Check if we can simply update the constraint or if the column is already flexible

-- For now, let's just ensure 'received' is a valid value by removing any restrictive constraints
-- and adding a new constraint that includes 'received'

-- Drop existing constraint if it exists
ALTER TABLE stock_requests DROP CONSTRAINT IF EXISTS stock_requests_status_check;

-- Add a new constraint that includes 'received'
ALTER TABLE stock_requests ADD CONSTRAINT stock_requests_status_check 
CHECK (status IN ('submitted', 'approved', 'rejected', 'in_pick', 'in_transit', 'cancelled', 'amend', 'received'));

-- Update any existing 'delivered' status to 'received' (in case there are any)
UPDATE stock_requests SET status = 'received' WHERE status = 'delivered';