-- Fix order number generation to handle high-volume imports
-- The current function has collision issues during bulk imports

-- First, let's increase the retry count and improve the collision handling
-- We'll also ensure the sequence starts higher than existing order numbers

-- Get the current max order number and adjust the sequence
DO $$
DECLARE
    max_order_num INTEGER;
    current_seq_val INTEGER;
BEGIN
    -- Extract the numeric part from existing order numbers and find the max
    SELECT COALESCE(MAX(
        CASE 
            WHEN order_number ~ '^ORD\d{4}-\d+$' 
            THEN CAST(SPLIT_PART(SPLIT_PART(order_number, '-', 2), 'E', 1) AS INTEGER)
            ELSE 0
        END
    ), 0) INTO max_order_num
    FROM orders
    WHERE order_number IS NOT NULL;
    
    -- Get current sequence value
    SELECT last_value INTO current_seq_val FROM order_number_seq;
    
    -- If sequence is behind the max order number, advance it
    IF current_seq_val <= max_order_num THEN
        PERFORM setval('order_number_seq', max_order_num + 100);
        RAISE NOTICE 'Advanced order_number_seq from % to %', current_seq_val, max_order_num + 100;
    END IF;
END $$;

-- Create an improved order number generation function with better collision handling
CREATE OR REPLACE FUNCTION public.generate_order_number_safe()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    attempt_count INTEGER := 0;
    max_attempts INTEGER := 10;
    new_order_number TEXT;
    collision_exists BOOLEAN;
BEGIN
  -- Only generate order number if it's NULL or empty
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    LOOP
      BEGIN
        -- Generate order number with some randomness to reduce collisions
        new_order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || 
                           LPAD((NEXTVAL('order_number_seq') + (random() * 10)::INTEGER)::TEXT, 4, '0');
        
        -- Check if this order number already exists
        SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_order_number) INTO collision_exists;
        
        -- If no collision, use this number
        IF NOT collision_exists THEN
          NEW.order_number := new_order_number;
          EXIT;
        END IF;
        
        attempt_count := attempt_count + 1;
        
        -- If we've tried too many times, fall back to a more unique approach
        IF attempt_count >= max_attempts THEN
          NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || 
                             LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0') || '-' || 
                             LPAD(EXTRACT(EPOCH FROM clock_timestamp())::INTEGER::TEXT, 6, '0');
          EXIT;
        END IF;
        
      EXCEPTION WHEN unique_violation THEN
        -- Continue the loop to try again
        attempt_count := attempt_count + 1;
        IF attempt_count >= max_attempts THEN
          RAISE EXCEPTION 'Could not generate unique order number after % attempts', max_attempts;
        END IF;
      END;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Replace the existing trigger with the safer version
DROP TRIGGER IF EXISTS generate_order_number_trigger ON orders;
CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW 
  EXECUTE FUNCTION generate_order_number_safe();