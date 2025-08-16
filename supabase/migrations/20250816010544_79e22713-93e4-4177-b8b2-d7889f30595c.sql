-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Update the generate_order_number function to use sequence
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' OR NEW.order_number = 'TEMP' THEN
    NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for order number generation
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- Backfill existing orders with proper order numbers
UPDATE public.orders 
SET order_number = 'ORD' || TO_CHAR(created_at, 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0')
WHERE order_number IS NULL OR order_number = '' OR order_number = 'TEMP';

-- Add unique index on order_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_unique ON public.orders(order_number);