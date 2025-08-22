-- Create enums for purchase orders and returns
CREATE TYPE purchase_order_status AS ENUM ('draft', 'pending', 'approved', 'received', 'cancelled');
CREATE TYPE return_rma_status AS ENUM ('pending_return', 'in_transit', 'received_by_supplier', 'replacement_sent', 'replacement_received', 'closed', 'cancelled');

-- Purchase Orders table
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  supplier_id UUID REFERENCES inventory_suppliers(id),
  status purchase_order_status NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase Order Lines table
CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase Receipts table (for partial receipts)
CREATE TABLE purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  po_line_id UUID NOT NULL REFERENCES purchase_order_lines(id),
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id),
  notes TEXT,
  received_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Returns & RMAs table
CREATE TABLE returns_rmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_number TEXT NOT NULL UNIQUE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  supplier_id UUID REFERENCES inventory_suppliers(id),
  serial_number TEXT,
  status return_rma_status NOT NULL DEFAULT 'pending_return',
  return_reason TEXT NOT NULL,
  return_date DATE,
  replacement_expected_date DATE,
  replacement_received_date DATE,
  replacement_serial_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Returns & RMA Lines (for tracking multiple items in one RMA)
CREATE TABLE returns_rma_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_id UUID NOT NULL REFERENCES returns_rmas(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  serial_numbers TEXT[], -- Array for multiple serial numbers
  condition_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at);
CREATE INDEX idx_purchase_order_lines_po_id ON purchase_order_lines(purchase_order_id);
CREATE INDEX idx_purchase_receipts_po_id ON purchase_receipts(purchase_order_id);
CREATE INDEX idx_returns_rmas_item_id ON returns_rmas(item_id);
CREATE INDEX idx_returns_rmas_status ON returns_rmas(status);
CREATE INDEX idx_returns_rma_lines_rma_id ON returns_rma_lines(rma_id);

-- Add triggers for updated_at
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_returns_rmas_updated_at
  BEFORE UPDATE ON returns_rmas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate PO numbers
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate RMA numbers
CREATE OR REPLACE FUNCTION generate_rma_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rma_number IS NULL OR NEW.rma_number = '' THEN
    NEW.rma_number := 'RMA' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for auto-generating numbers
CREATE TRIGGER generate_po_number_trigger
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_po_number();

CREATE TRIGGER generate_rma_number_trigger
  BEFORE INSERT ON returns_rmas
  FOR EACH ROW
  EXECUTE FUNCTION generate_rma_number();

-- RLS Policies for Purchase Orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all purchase orders"
ON purchase_orders FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers can view purchase orders"
ON purchase_orders FOR SELECT
USING (is_admin() OR is_manager());

-- RLS Policies for Purchase Order Lines
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage PO lines"
ON purchase_order_lines FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers can view PO lines"
ON purchase_order_lines FOR SELECT
USING (is_admin() OR is_manager());

-- RLS Policies for Purchase Receipts
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage receipts"
ON purchase_receipts FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers can view receipts"
ON purchase_receipts FOR SELECT
USING (is_admin() OR is_manager());

-- RLS Policies for Returns & RMAs
ALTER TABLE returns_rmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all RMAs"
ON returns_rmas FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers can view RMAs"
ON returns_rmas FOR SELECT
USING (is_admin() OR is_manager());

CREATE POLICY "Engineers can view RMAs for their items"
ON returns_rmas FOR SELECT
USING (
  is_admin() OR is_manager() OR
  -- Engineers can see RMAs for items they've used
  EXISTS (
    SELECT 1 FROM engineer_materials_used emu
    JOIN engineers e ON e.id = emu.engineer_id
    WHERE e.user_id = auth.uid()
      AND emu.item_id = returns_rmas.item_id
  )
);

-- RLS Policies for Returns & RMA Lines
ALTER TABLE returns_rma_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage RMA lines"
ON returns_rma_lines FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Managers can view RMA lines"
ON returns_rma_lines FOR SELECT
USING (is_admin() OR is_manager());