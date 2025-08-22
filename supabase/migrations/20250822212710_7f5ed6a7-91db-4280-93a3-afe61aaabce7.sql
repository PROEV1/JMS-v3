-- Direct test update on a single order to isolate the issue
UPDATE orders 
SET status_enhanced = 'on_hold_parts_docs'::order_status_enhanced,
    updated_at = NOW()
WHERE order_number = 'ORD2025-4130';

-- Check if it worked
-- Also let's check if there are any other triggers interfering