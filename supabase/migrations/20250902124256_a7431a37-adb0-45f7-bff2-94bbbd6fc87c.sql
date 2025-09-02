-- Allow NULL values for total_amount in orders table
-- This enables importing orders with missing/invalid quote amounts as NULL instead of 0
ALTER TABLE public.orders 
ALTER COLUMN total_amount DROP NOT NULL,
ALTER COLUMN total_amount DROP DEFAULT;