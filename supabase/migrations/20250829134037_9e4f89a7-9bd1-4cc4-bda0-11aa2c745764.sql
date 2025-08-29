-- Add 'received' status to stock_requests status enum
-- First, we need to check if there's an enum type or constraint for status

-- If there's an enum type, we need to add the new value
DO $$ 
BEGIN
    -- Check if enum type exists and add 'received' if it doesn't exist
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_request_status') THEN
        -- Add 'received' to the enum if it doesn't already exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'received' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'stock_request_status')) THEN
            ALTER TYPE stock_request_status ADD VALUE 'received';
        END IF;
    ELSE
        -- If no enum exists, check for constraints and create enum
        -- First create the enum type with all current values plus 'received'
        CREATE TYPE stock_request_status AS ENUM ('submitted', 'approved', 'rejected', 'in_pick', 'in_transit', 'cancelled', 'amend', 'received');
        
        -- Update the column to use the enum type
        ALTER TABLE stock_requests ALTER COLUMN status TYPE stock_request_status USING status::stock_request_status;
    END IF;
END $$;