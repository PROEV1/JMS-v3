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
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_suppliers' AND policyname = 'Admins manage suppliers') THEN
    CREATE POLICY "Admins manage suppliers" ON public.inventory_suppliers FOR ALL 
    USING (is_admin()) WITH CHECK (is_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_suppliers' AND policyname = 'Managers can view suppliers') THEN
    CREATE POLICY "Managers can view suppliers" ON public.inventory_suppliers FOR SELECT 
    USING (is_admin() OR is_manager());
  END IF;
END $$;

-- Insert sample suppliers if they don't exist
INSERT INTO public.inventory_suppliers (name, contact_email, is_active) 
SELECT 'Main Electrical Supplies', 'orders@mainelectrical.com', true
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_suppliers WHERE name = 'Main Electrical Supplies');

INSERT INTO public.inventory_suppliers (name, contact_email, is_active) 
SELECT 'EV Parts Direct', 'sales@evpartsdirect.com', true
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_suppliers WHERE name = 'EV Parts Direct');

INSERT INTO public.inventory_suppliers (name, contact_email, is_active) 
SELECT 'Local Hardware Store', 'info@localhardware.com', true
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_suppliers WHERE name = 'Local Hardware Store');

-- Insert sample inventory locations if they don't exist
INSERT INTO public.inventory_locations (name, code, type, is_active) 
SELECT 'Main Warehouse', 'WH001', 'warehouse', true
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE name = 'Main Warehouse');

INSERT INTO public.inventory_locations (name, code, type, is_active) 
SELECT 'South London Depot', 'WH002', 'warehouse', true
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE name = 'South London Depot');

INSERT INTO public.inventory_locations (name, code, type, is_active) 
SELECT 'North London Depot', 'WH003', 'warehouse', true
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE name = 'North London Depot');