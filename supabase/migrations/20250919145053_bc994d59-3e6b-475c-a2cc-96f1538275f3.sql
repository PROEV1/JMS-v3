-- Add purchase order integration to order_parts table
ALTER TABLE public.order_parts 
ADD COLUMN purchase_order_id UUID REFERENCES public.purchase_orders(id);

-- Add source order reference to purchase_orders table
ALTER TABLE public.purchase_orders 
ADD COLUMN source_order_id UUID REFERENCES public.orders(id);

-- Create indexes for better performance
CREATE INDEX idx_order_parts_purchase_order_id ON public.order_parts(purchase_order_id);
CREATE INDEX idx_purchase_orders_source_order_id ON public.purchase_orders(source_order_id);

-- Add comments for documentation
COMMENT ON COLUMN public.order_parts.purchase_order_id IS 'Links to the official purchase order created for these parts';
COMMENT ON COLUMN public.purchase_orders.source_order_id IS 'Customer order that triggered this purchase order';