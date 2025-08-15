-- Fix corrupted quote number that contains timestamp
UPDATE quotes 
SET quote_number = 'Q-34508' 
WHERE quote_number = 'Q-1753470280378';

-- Also fix the generate_quote_number function to be more robust
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
        -- Filter out any malformed quote numbers by ensuring they are valid integers
        SELECT GREATEST(
            COALESCE(
                MAX(
                    CASE 
                        WHEN quote_number ~ '^Q-[0-9]+$' 
                        AND LENGTH(SUBSTRING(quote_number FROM 3)) <= 10 -- Prevent timestamp values
                        AND CAST(SUBSTRING(quote_number FROM 3) AS BIGINT) < 2147483647 -- Max int32
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
$function$;