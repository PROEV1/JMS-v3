-- Fix order number sequence to prevent collisions
SELECT setval('order_number_seq', 4814, false);