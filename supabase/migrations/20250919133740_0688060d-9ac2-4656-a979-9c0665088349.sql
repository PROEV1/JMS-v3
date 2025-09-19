-- Manually trigger status recalculation for the specific order
-- This simulates what would happen when the order is next updated
UPDATE orders 
SET status_enhanced = public.calculate_order_status_final(orders.*),
    updated_at = now()
WHERE order_number = 'ORD2025-040527';