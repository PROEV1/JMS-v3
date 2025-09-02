-- Remove duplicate order number generation triggers, keep only one
DROP TRIGGER IF EXISTS generate_order_number_trigger ON public.orders;
DROP TRIGGER IF EXISTS orders_generate_order_number ON public.orders;  
DROP TRIGGER IF EXISTS trg_generate_order_number ON public.orders;
-- Keep: trigger_generate_order_number

-- Ensure the sequence exists for order number generation
CREATE SEQUENCE IF NOT EXISTS order_number_seq;