-- Create sequence for sequential PO numbers
CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq START 1;

-- Add reference field to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN reference TEXT;

-- Create function to generate sequential PO numbers
CREATE OR REPLACE FUNCTION generate_sequential_po_number() 
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    current_year INTEGER;
    po_number TEXT;
BEGIN
    SELECT EXTRACT(YEAR FROM NOW()) INTO current_year;
    SELECT nextval('purchase_order_number_seq') INTO next_num;
    po_number := 'PO' || current_year || '-' || LPAD(next_num::text, 6, '0');
    RETURN po_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;