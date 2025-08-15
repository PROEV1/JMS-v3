-- Add triggers for auto-generating quote_number and order_number if they don't exist

-- First, check if the quote_number_seq sequence exists, if not create it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'quote_number_seq') THEN
        CREATE SEQUENCE quote_number_seq START 1;
    END IF;
END $$;

-- Update the generate_quote_number function to be more robust
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := 'Q' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(NEXTVAL('quote_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for quotes table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_quote_number' 
        AND tgrelid = 'public.quotes'::regclass
    ) THEN
        CREATE TRIGGER set_quote_number
            BEFORE INSERT ON public.quotes
            FOR EACH ROW
            EXECUTE FUNCTION public.generate_quote_number();
    END IF;
END $$;

-- Update the generate_order_number function to be more robust
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'ORD' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(EXTRACT(EPOCH FROM now())::INT::TEXT, 10, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger for orders table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_order_number' 
        AND tgrelid = 'public.orders'::regclass
    ) THEN
        CREATE TRIGGER set_order_number
            BEFORE INSERT ON public.orders
            FOR EACH ROW
            EXECUTE FUNCTION public.generate_order_number();
    END IF;
END $$;