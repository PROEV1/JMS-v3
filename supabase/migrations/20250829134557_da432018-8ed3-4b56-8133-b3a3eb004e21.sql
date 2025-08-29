-- Check what constraints exist on the status column
SELECT 
    conname as constraint_name,
    consrc as constraint_definition
FROM pg_constraint 
WHERE conrelid = (SELECT oid FROM pg_class WHERE relname = 'stock_requests')
AND conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = (SELECT oid FROM pg_class WHERE relname = 'stock_requests') AND attname = 'status')];

-- Also check for check constraints
SELECT 
    cc.constraint_name,
    cc.check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'stock_requests' AND ccu.column_name = 'status';

-- Test direct update to received
UPDATE stock_requests 
SET status = 'received', 
    notes = 'Test: Manual update to received status',
    updated_at = now()
WHERE id = 'c8cd3443-9771-4853-a4b4-d492894964fc'
RETURNING id, status, notes;