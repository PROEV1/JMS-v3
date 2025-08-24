-- Add missing foreign key constraint between order_payments and orders
ALTER TABLE public.order_payments 
ADD CONSTRAINT fk_order_payments_order_id 
FOREIGN KEY (order_id) REFERENCES public.orders(id) 
ON DELETE CASCADE;