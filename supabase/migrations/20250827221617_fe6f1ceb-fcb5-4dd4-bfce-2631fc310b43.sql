-- Add purchase_order_id to stock_requests table to track which PO was created from this request
ALTER TABLE public.stock_requests 
ADD COLUMN purchase_order_id uuid REFERENCES public.purchase_orders(id);

-- Add stock_request_id to purchase_orders table to track which stock request generated this PO
ALTER TABLE public.purchase_orders 
ADD COLUMN stock_request_id uuid REFERENCES public.stock_requests(id);

-- Create indexes for better performance
CREATE INDEX idx_stock_requests_purchase_order_id ON public.stock_requests(purchase_order_id);
CREATE INDEX idx_purchase_orders_stock_request_id ON public.purchase_orders(stock_request_id);