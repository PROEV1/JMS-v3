-- Update the status for the specific order that was signed off by engineer
UPDATE orders 
SET status_enhanced = public.calculate_order_status_with_offers(orders.*),
    updated_at = NOW()
WHERE id = '42ae584d-7e06-4cbb-afd1-b07a7a0b564e';