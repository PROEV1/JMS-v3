-- Create separate sequences for different entity types
CREATE SEQUENCE IF NOT EXISTS po_number_seq START WITH 1000;
CREATE SEQUENCE IF NOT EXISTS rma_number_seq START WITH 1000;

-- Reset sequences based on existing data
-- Get the highest order number and set the sequence accordingly
DO $$
DECLARE
    max_order_num INTEGER := 0;
    max_po_num INTEGER := 0;
    max_rma_num INTEGER := 0;
BEGIN
    -- Get max order number (extract numeric part after ORD)
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 'ORD[0-9]+-([0-9]+)') AS INTEGER)), 0) 
    INTO max_order_num 
    FROM orders 
    WHERE order_number ~ '^ORD[0-9]+-[0-9]+$';
    
    -- Get max PO number (extract numeric part after PO)
    SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 'PO[0-9]+-([0-9]+)') AS INTEGER)), 0) 
    INTO max_po_num 
    FROM purchase_orders 
    WHERE po_number ~ '^PO[0-9]+-[0-9]+$';
    
    -- Get max RMA number (extract numeric part after RMA)
    SELECT COALESCE(MAX(CAST(SUBSTRING(rma_number FROM 'RMA[0-9]+-([0-9]+)') AS INTEGER)), 0) 
    INTO max_rma_num 
    FROM returns_rmas 
    WHERE rma_number ~ '^RMA[0-9]+-[0-9]+$';
    
    -- Set sequences to next available number
    PERFORM setval('order_number_seq', GREATEST(max_order_num + 1, 1000));
    PERFORM setval('po_number_seq', GREATEST(max_po_num + 1, 1000));
    PERFORM setval('rma_number_seq', GREATEST(max_rma_num + 1, 1000));
    
    -- Log the reset values
    RAISE NOTICE 'Reset sequences - Orders: %, POs: %, RMAs: %', max_order_num + 1, max_po_num + 1, max_rma_num + 1;
END $$;

-- Update trigger functions to use dedicated sequences
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_po_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    NEW.po_number := 'PO' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('po_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_rma_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.rma_number IS NULL OR NEW.rma_number = '' THEN
    NEW.rma_number := 'RMA' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('rma_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;