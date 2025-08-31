-- Fix the order number sequence to prevent duplicates
-- Get the current maximum order number and reset the sequence
DO $$
DECLARE
    max_order_num INTEGER;
BEGIN
    -- Get the highest order number from existing orders
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'ORD\d{4}-(\d+)') AS INTEGER)), 0)
    INTO max_order_num
    FROM orders 
    WHERE order_number ~ '^ORD\d{4}-\d+$';
    
    -- Reset the sequence to start from max + 1
    PERFORM setval('order_number_seq', max_order_num + 1, false);
    
    RAISE NOTICE 'Reset order_number_seq to start from % (max existing: %)', max_order_num + 1, max_order_num;
END $$;