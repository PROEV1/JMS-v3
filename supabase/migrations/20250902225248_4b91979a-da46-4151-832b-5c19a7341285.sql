-- Reset the order number sequence to avoid conflicts
SELECT setval('order_number_seq', (
  SELECT COALESCE(MAX(CAST(split_part(split_part(order_number, '-', 2), '-', 1) AS INTEGER)), 0) + 1000
  FROM orders 
  WHERE order_number ~ '^ORD[0-9]{4}-[0-9]+-.*$'
), false);

-- Drop and recreate the order number generation trigger with better collision handling
DROP TRIGGER IF EXISTS generate_order_number_trigger ON orders;
DROP FUNCTION IF EXISTS generate_order_number();

-- Create improved order number generation function
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_year TEXT;
  v_base_number TEXT;
  v_attempt INTEGER := 0;
  v_max_attempts INTEGER := 100;
BEGIN
  -- Only generate order number if it's NULL or empty
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    v_year := TO_CHAR(now(), 'YYYY');
    
    -- Try to generate a unique order number with retries
    LOOP
      v_attempt := v_attempt + 1;
      
      -- Get next sequence value and add attempt number for uniqueness
      v_base_number := LPAD((NEXTVAL('order_number_seq') + v_attempt)::TEXT, 4, '0');
      NEW.order_number := 'ORD' || v_year || '-' || v_base_number;
      
      -- Check if this order number already exists
      PERFORM 1 FROM orders WHERE order_number = NEW.order_number;
      
      -- If no duplicate found, break out of loop
      IF NOT FOUND THEN
        EXIT;
      END IF;
      
      -- If we've tried too many times, add timestamp for absolute uniqueness
      IF v_attempt >= v_max_attempts THEN
        NEW.order_number := 'ORD' || v_year || '-' || v_base_number || '-' || EXTRACT(EPOCH FROM now())::BIGINT;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();