-- Drop any duplicate foreign key constraints and recreate them properly
-- First, let's check and clean up the foreign key relationships

-- Drop existing constraints if they exist
ALTER TABLE public.order_payments DROP CONSTRAINT IF EXISTS fk_order_payments_order_id;
ALTER TABLE public.order_payments DROP CONSTRAINT IF EXISTS order_payments_order_id_fkey;

-- Drop existing quotes constraint if it exists
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_order_id_fkey;

-- Create the proper foreign key constraint for order_payments
ALTER TABLE public.order_payments 
ADD CONSTRAINT order_payments_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- Make sure quotes table has the proper relationship
-- Check if quotes should reference orders or if orders should reference quotes
-- Based on the schema, orders should reference quotes (orders.quote_id -> quotes.id)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_quote_id_fkey;
ALTER TABLE public.orders 
ADD CONSTRAINT orders_quote_id_fkey 
FOREIGN KEY (quote_id) REFERENCES public.quotes(id) 
ON DELETE SET NULL;