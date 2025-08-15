-- Fix existing quote with empty quote_number
UPDATE quotes 
SET quote_number = 'Q' || TO_CHAR(created_at, 'YYYY') || '-' || LPAD(EXTRACT(EPOCH FROM created_at)::INTEGER::TEXT, 10, '0') || LPAD(EXTRACT(MICROSECONDS FROM created_at)::INTEGER::TEXT, 6, '0')
WHERE quote_number IS NULL OR quote_number = '';

-- Update the trigger function to handle empty strings as well
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
        NEW.quote_number := 'Q' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(EXTRACT(EPOCH FROM now())::INTEGER::TEXT, 10, '0') || LPAD(EXTRACT(MICROSECONDS FROM now())::INTEGER::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';