-- Fix the function to have proper search_path
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';