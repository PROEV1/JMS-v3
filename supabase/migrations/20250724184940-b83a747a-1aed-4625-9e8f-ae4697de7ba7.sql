-- Fix function search path security issue by setting search_path explicitly
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(EXTRACT(EPOCH FROM now())::INTEGER::TEXT, 10, '0');
    END IF;
    RETURN NEW;
END;
$$;