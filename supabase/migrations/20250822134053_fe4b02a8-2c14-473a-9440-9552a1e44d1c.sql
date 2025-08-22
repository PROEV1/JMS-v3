-- Create trigger to auto-generate order numbers on insert
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' OR NEW.order_number = 'TEMP' THEN
    NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS generate_order_number_trigger ON public.orders;
CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- Backfill existing TEMP/NULL order numbers
UPDATE public.orders 
SET order_number = 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0')
WHERE order_number IS NULL OR order_number = '' OR order_number = 'TEMP';