-- Add engineer_id field to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN engineer_id UUID REFERENCES public.engineers(id);

-- Add index for better query performance
CREATE INDEX idx_purchase_orders_engineer_id ON public.purchase_orders(engineer_id);

-- Add comment for documentation
COMMENT ON COLUMN public.purchase_orders.engineer_id IS 'Optional engineer assignment for tracking POs to specific engineers';