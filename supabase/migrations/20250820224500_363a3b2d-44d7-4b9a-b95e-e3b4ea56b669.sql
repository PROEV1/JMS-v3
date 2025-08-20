-- Create missing tables for inventory system

-- Stock requests table
CREATE TABLE public.stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID NOT NULL REFERENCES public.engineers(id),
  destination_location_id UUID NOT NULL REFERENCES public.inventory_locations(id),
  order_id UUID REFERENCES public.orders(id),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'in_pick', 'in_transit', 'delivered', 'cancelled')),
  needed_by DATE,
  notes TEXT,
  photo_url TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Stock request lines table  
CREATE TABLE public.stock_request_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.stock_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  qty INTEGER NOT NULL CHECK (qty > 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Charger dispatches table
CREATE TABLE public.charger_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  charger_item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending_dispatch' CHECK (status IN ('pending_dispatch', 'sent', 'delivered', 'cancelled')),
  tracking_number TEXT,
  dispatched_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_lines ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.charger_dispatches ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_requests
CREATE POLICY "Admins can manage all stock requests" 
ON public.stock_requests FOR ALL 
USING (is_admin());

CREATE POLICY "Engineers can view and create their own stock requests"
ON public.stock_requests FOR ALL
USING (engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid()) OR is_admin());

-- RLS policies for stock_request_lines
CREATE POLICY "Admins can manage all stock request lines"
ON public.stock_request_lines FOR ALL
USING (is_admin());

CREATE POLICY "Engineers can manage lines for their own requests"
ON public.stock_request_lines FOR ALL
USING (
  request_id IN (
    SELECT id FROM stock_requests 
    WHERE engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid())
  ) OR is_admin()
);

-- RLS policies for charger_dispatches
CREATE POLICY "Admins can manage all charger dispatches"
ON public.charger_dispatches FOR ALL
USING (is_admin());

CREATE POLICY "Engineers can view dispatches for their orders"
ON public.charger_dispatches FOR SELECT
USING (
  order_id IN (
    SELECT id FROM orders 
    WHERE engineer_id IN (SELECT id FROM engineers WHERE user_id = auth.uid())
  ) OR is_admin()
);

-- Create indexes for performance
CREATE INDEX idx_stock_requests_engineer_id ON public.stock_requests(engineer_id);
CREATE INDEX idx_stock_requests_status ON public.stock_requests(status);
CREATE INDEX idx_stock_requests_created_at ON public.stock_requests(created_at);
CREATE INDEX idx_stock_request_lines_request_id ON public.stock_request_lines(request_id);
CREATE INDEX idx_charger_dispatches_order_id ON public.charger_dispatches(order_id);
CREATE INDEX idx_charger_dispatches_status ON public.charger_dispatches(status);

-- Create update trigger for timestamps
CREATE TRIGGER update_stock_requests_updated_at
  BEFORE UPDATE ON public.stock_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_charger_dispatches_updated_at
  BEFORE UPDATE ON public.charger_dispatches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();