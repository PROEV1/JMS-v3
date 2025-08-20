-- Create inventory suppliers table if not exists
CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for inventory_suppliers
ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;

-- Create policies for inventory_suppliers
CREATE POLICY "Admins manage suppliers" ON public.inventory_suppliers FOR ALL 
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Managers can view suppliers" ON public.inventory_suppliers FOR SELECT 
USING (is_admin() OR is_manager());

-- Insert some sample suppliers
INSERT INTO public.inventory_suppliers (name, contact_email, is_active) VALUES
('Main Electrical Supplies', 'orders@mainelectrical.com', true),
('EV Parts Direct', 'sales@evpartsdirect.com', true),
('Local Hardware Store', 'info@localhardware.com', true)
ON CONFLICT DO NOTHING;

-- Insert some sample inventory locations
INSERT INTO public.inventory_locations (name, code, type, is_active) VALUES
('Main Warehouse', 'WH001', 'warehouse', true),
('South London Depot', 'WH002', 'warehouse', true),
('North London Depot', 'WH003', 'warehouse', true)
ON CONFLICT DO NOTHING;

-- Add an updated_at trigger for inventory_suppliers
CREATE TRIGGER update_inventory_suppliers_updated_at
    BEFORE UPDATE ON public.inventory_suppliers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample inventory items
INSERT INTO public.inventory_items (name, sku, description, unit, default_cost, min_level, max_level, reorder_point, is_active) VALUES
('EV Charging Cable Type 2', 'CABLE-T2-001', '32A Type 2 charging cable 5 meters', 'each', 89.99, 5, 50, 10, true),
('Wall Mount Bracket', 'BRACKET-WM-001', 'Universal wall mount bracket for EV chargers', 'each', 45.50, 10, 100, 20, true),
('Circuit Breaker 32A', 'CB-32A-001', '32A single pole circuit breaker', 'each', 25.99, 5, 30, 8, true),
('RCD Protection Unit', 'RCD-30MA-001', '30mA RCD protection unit', 'each', 67.00, 3, 20, 5, true),
('Electrical Conduit 20mm', 'CONDUIT-20MM', '20mm electrical conduit per meter', 'meter', 3.50, 50, 500, 100, true)
ON CONFLICT (sku) DO NOTHING;