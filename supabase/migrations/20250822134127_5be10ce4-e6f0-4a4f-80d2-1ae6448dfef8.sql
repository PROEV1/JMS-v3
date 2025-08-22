-- Fix search path for the generate_order_number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' OR NEW.order_number = 'TEMP' THEN
    NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;