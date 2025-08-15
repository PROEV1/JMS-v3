-- Update the quote number generation function to properly start from 34501
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    next_number INTEGER;
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
        -- Get the highest existing Q number or start from 34500
        -- Ensure we always start from at least 34501
        SELECT GREATEST(
            COALESCE(
                MAX(
                    CASE 
                        WHEN quote_number ~ '^Q-[0-9]+$' 
                        THEN CAST(SUBSTRING(quote_number FROM 3) AS INTEGER)
                        ELSE 0
                    END
                ), 34500
            ), 34500
        ) + 1 INTO next_number
        FROM quotes;
        
        NEW.quote_number := 'Q-' || next_number;
    END IF;
    RETURN NEW;
END;
$function$