-- Add 'received' status to stock_requests status
-- First, handle the default value and then create/update the enum

DO $$ 
BEGIN
    -- Check if enum type already exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_request_status') THEN
        -- Add 'received' to existing enum if it doesn't already exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'received' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'stock_request_status')) THEN
            ALTER TYPE stock_request_status ADD VALUE 'received';
        END IF;
    ELSE
        -- Remove any existing default temporarily
        ALTER TABLE stock_requests ALTER COLUMN status DROP DEFAULT;
        
        -- Create the enum type with all values including 'received'
        CREATE TYPE stock_request_status AS ENUM ('submitted', 'approved', 'rejected', 'in_pick', 'in_transit', 'cancelled', 'amend', 'received');
        
        -- Update the column to use the enum type
        ALTER TABLE stock_requests ALTER COLUMN status TYPE stock_request_status USING status::stock_request_status;
        
        -- Restore the default value
        ALTER TABLE stock_requests ALTER COLUMN status SET DEFAULT 'submitted'::stock_request_status;
    END IF;
END $$;