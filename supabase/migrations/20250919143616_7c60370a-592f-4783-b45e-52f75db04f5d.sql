-- Create order_parts table to track parts ordered for specific orders
CREATE TABLE public.order_parts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.inventory_suppliers(id),
  order_number TEXT NOT NULL,
  net_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  items_ordered JSONB NOT NULL DEFAULT '[]'::jsonb,
  ordered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.order_parts ENABLE ROW LEVEL SECURITY;

-- Create policies for order_parts
CREATE POLICY "Admins can manage all order parts" 
ON public.order_parts 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Engineers can view parts for their orders" 
ON public.order_parts 
FOR SELECT 
USING (
  order_id IN (
    SELECT o.id 
    FROM orders o 
    JOIN engineers e ON o.engineer_id = e.id 
    WHERE e.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view parts for their orders" 
ON public.order_parts 
FOR SELECT 
USING (
  order_id IN (
    SELECT o.id 
    FROM orders o 
    JOIN clients c ON o.client_id = c.id 
    WHERE c.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_order_parts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_parts_updated_at
  BEFORE UPDATE ON public.order_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_parts_updated_at();

-- Create index for performance
CREATE INDEX idx_order_parts_order_id ON public.order_parts(order_id);
CREATE INDEX idx_order_parts_supplier_id ON public.order_parts(supplier_id);