-- Simple approach: check if we can just allow 'received' as a valid status
-- First, let's see what constraints exist on the status column

-- Check if there are any check constraints on status column
DO $$
DECLARE
    constraint_exists BOOLEAN := FALSE;
    enum_exists BOOLEAN := FALSE;
BEGIN
    -- Check if enum type exists
    SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_request_status') INTO enum_exists;
    
    -- Check if there are check constraints
    SELECT EXISTS (
        SELECT 1 FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_name = 'stock_requests' AND ccu.column_name = 'status'
    ) INTO constraint_exists;
    
    IF enum_exists THEN
        -- Add 'received' to existing enum if not already there
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'received' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'stock_request_status')) THEN
            ALTER TYPE stock_request_status ADD VALUE 'received';
            RAISE NOTICE 'Added received to existing enum';
        ELSE
            RAISE NOTICE 'received already exists in enum';
        END IF;
    ELSIF constraint_exists THEN
        -- Remove existing check constraint and create a new one that includes 'received'
        -- This is more complex, so for now just log that constraints exist
        RAISE NOTICE 'Check constraints exist - would need manual handling';
    ELSE
        -- No constraints exist, status is just text - should work as is
        RAISE NOTICE 'No enum or constraints found - status should accept any text value';
    END IF;
END $$;