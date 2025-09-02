-- Create returns_rmas table for tracking product returns and warranty claims
CREATE TABLE public.returns_rmas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rma_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.inventory_suppliers(id),
  rma_type TEXT NOT NULL CHECK (rma_type IN ('return', 'warranty', 'exchange')),
  status TEXT NOT NULL DEFAULT 'pending_return' CHECK (status IN ('pending_return', 'in_transit', 'received_by_supplier', 'replacement_sent', 'replacement_received', 'closed', 'cancelled')),
  original_order_id TEXT,
  return_reason TEXT NOT NULL,
  return_date DATE,
  replacement_serial_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create returns_rma_lines table for individual items being returned
CREATE TABLE public.returns_rma_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rma_id UUID NOT NULL REFERENCES public.returns_rmas(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.inventory_items(id),
  charger_id UUID REFERENCES public.charger_inventory(id),
  item_type TEXT NOT NULL CHECK (item_type IN ('inventory', 'charger')),
  quantity INTEGER NOT NULL DEFAULT 1,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('damaged', 'defective', 'wrong_item', 'excess', 'expired')),
  line_reason TEXT NOT NULL,
  serial_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence for RMA numbers
CREATE SEQUENCE IF NOT EXISTS rma_number_seq START 1;

-- Create trigger to auto-generate RMA numbers
CREATE OR REPLACE FUNCTION public.generate_rma_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rma_number IS NULL OR NEW.rma_number = '' THEN
    NEW.rma_number := 'RMA' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('rma_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_rma_number
  BEFORE INSERT ON public.returns_rmas
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_rma_number();

-- Create indexes for performance
CREATE INDEX idx_returns_rmas_supplier_id ON public.returns_rmas(supplier_id);
CREATE INDEX idx_returns_rmas_status ON public.returns_rmas(status);
CREATE INDEX idx_returns_rmas_created_at ON public.returns_rmas(created_at);
CREATE INDEX idx_returns_rma_lines_rma_id ON public.returns_rma_lines(rma_id);

-- Enable RLS
ALTER TABLE public.returns_rmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns_rma_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for returns_rmas
CREATE POLICY "Admins can manage all returns/RMAs" 
ON public.returns_rmas 
FOR ALL 
USING (is_admin());

CREATE POLICY "Users can view returns/RMAs they created" 
ON public.returns_rmas 
FOR SELECT 
USING (created_by = auth.uid() OR is_admin());

-- RLS policies for returns_rma_lines  
CREATE POLICY "Admins can manage all RMA lines" 
ON public.returns_rma_lines 
FOR ALL 
USING (is_admin());

CREATE POLICY "Users can view RMA lines for their RMAs" 
ON public.returns_rma_lines 
FOR SELECT 
USING (
  rma_id IN (
    SELECT id FROM public.returns_rmas 
    WHERE created_by = auth.uid() OR is_admin()
  )
);