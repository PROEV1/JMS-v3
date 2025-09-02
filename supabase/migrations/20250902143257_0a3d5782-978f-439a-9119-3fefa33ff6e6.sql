-- Fix duplicate order number generation issue

-- First, drop any existing triggers that might be duplicating order number generation
DROP TRIGGER IF EXISTS generate_order_number_trigger ON orders;
DROP TRIGGER IF EXISTS set_order_number_trigger ON orders;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;

-- Create a robust order number generation function
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate order number if it's NULL or empty
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    -- Use a loop to handle potential race conditions
    LOOP
      BEGIN
        NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
        
        -- Check if this order number already exists
        PERFORM 1 FROM orders WHERE order_number = NEW.order_number;
        
        -- If no duplicate found, break out of loop
        IF NOT FOUND THEN
          EXIT;
        END IF;
        
      EXCEPTION WHEN unique_violation THEN
        -- If we hit a unique violation, try again with next sequence number
        CONTINUE;
      END;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (only one)
CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Reset the sequence to a safe value above current max
-- Get the current maximum order number and set sequence accordingly
DO $$
DECLARE
  max_num INTEGER;
BEGIN
  -- Extract the numeric part from existing order numbers and find the maximum
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'ORD\d{4}-(\d+)') AS INTEGER)), 0) + 1000
  INTO max_num
  FROM orders 
  WHERE order_number ~ '^ORD\d{4}-\d+$';
  
  -- Set the sequence to start from this safe value
  PERFORM setval('order_number_seq', max_num);
END $$;