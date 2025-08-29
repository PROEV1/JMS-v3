-- Add amendment tracking fields to purchase_orders table
ALTER TABLE public.purchase_orders
ADD COLUMN amended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN amended_by UUID REFERENCES auth.users(id);