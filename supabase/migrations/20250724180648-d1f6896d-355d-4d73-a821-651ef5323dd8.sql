-- Drop and recreate the quote number generation with better uniqueness
DROP TRIGGER IF EXISTS set_quote_number ON quotes;
DROP FUNCTION IF EXISTS generate_quote_number() CASCADE;
DROP SEQUENCE IF EXISTS quote_number_seq CASCADE;

-- Create a simple function that uses timestamp-based unique numbers
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quote_number IS NULL THEN
        NEW.quote_number := 'Q' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(EXTRACT(EPOCH FROM now())::INTEGER::TEXT, 10, '0') || LPAD(EXTRACT(MICROSECONDS FROM now())::INTEGER::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

-- Create trigger
CREATE TRIGGER set_quote_number 
    BEFORE INSERT ON quotes 
    FOR EACH ROW 
    EXECUTE FUNCTION generate_quote_number();