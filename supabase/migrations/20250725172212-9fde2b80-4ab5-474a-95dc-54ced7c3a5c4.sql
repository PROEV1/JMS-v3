-- Update the order number generation function to use PS- prefix starting from 74510
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    next_number INTEGER;
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        -- Get the highest existing PS number or start from 74510
        SELECT COALESCE(
            MAX(
                CASE 
                    WHEN order_number ~ '^PS-[0-9]+$' 
                    THEN CAST(SUBSTRING(order_number FROM 4) AS INTEGER)
                    ELSE 0
                END
            ), 74509
        ) + 1 INTO next_number
        FROM orders;
        
        NEW.order_number := 'PS-' || next_number;
    END IF;
    RETURN NEW;
END;
$function$;

-- Update the quote number generation function to use Q- prefix starting from 34501
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    next_number INTEGER;
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
        -- Get the highest existing Q number or start from 34501
        SELECT COALESCE(
            MAX(
                CASE 
                    WHEN quote_number ~ '^Q-[0-9]+$' 
                    THEN CAST(SUBSTRING(quote_number FROM 3) AS INTEGER)
                    ELSE 0
                END
            ), 34500
        ) + 1 INTO next_number
        FROM quotes;
        
        NEW.quote_number := 'Q-' || next_number;
    END IF;
    RETURN NEW;
END;
$function$;