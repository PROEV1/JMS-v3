-- Reset the order number sequence to be higher than existing order numbers
-- First, find the highest existing order number and set sequence accordingly
DO $$
DECLARE
    max_num INTEGER := 0;
    seq_val INTEGER;
BEGIN
    -- Extract numeric part from existing order numbers and find maximum
    SELECT COALESCE(MAX(
        CASE 
            WHEN order_number ~ '^ORD[0-9]{4}-[0-9]+$' THEN
                CAST(SPLIT_PART(SPLIT_PART(order_number, '-', 2), '-', 1) AS INTEGER)
            ELSE 0
        END
    ), 0) INTO max_num
    FROM public.orders 
    WHERE order_number IS NOT NULL;
    
    -- Set sequence to be higher than the maximum found
    seq_val := max_num + 100; -- Add buffer of 100
    
    PERFORM setval('order_number_seq', seq_val, false);
    
    RAISE NOTICE 'Set order_number_seq to % (max existing order number was %)', seq_val, max_num;
END $$;