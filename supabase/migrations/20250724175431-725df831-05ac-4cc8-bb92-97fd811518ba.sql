-- Drop existing sequence and function to recreate them properly
DROP SEQUENCE IF EXISTS quote_number_seq CASCADE;
DROP FUNCTION IF EXISTS generate_quote_number() CASCADE;
DROP TRIGGER IF EXISTS set_quote_number ON quotes;

-- Create a new sequence for quote numbers
CREATE SEQUENCE quote_number_seq START 1;

-- Create improved quote number generation function
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
    new_number INTEGER;
    new_quote_number TEXT;
    max_attempts INTEGER := 10;
    attempt INTEGER := 0;
BEGIN
    -- Only generate if quote_number is null
    IF NEW.quote_number IS NULL THEN
        LOOP
            attempt := attempt + 1;
            
            -- Get next sequence value
            new_number := nextval('quote_number_seq');
            
            -- Generate quote number with current year
            new_quote_number := 'Q' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(new_number::TEXT, 4, '0');
            
            -- Check if this quote number already exists
            IF NOT EXISTS (SELECT 1 FROM quotes WHERE quote_number = new_quote_number) THEN
                NEW.quote_number := new_quote_number;
                EXIT;
            END IF;
            
            -- Prevent infinite loop
            IF attempt >= max_attempts THEN
                RAISE EXCEPTION 'Failed to generate unique quote number after % attempts', max_attempts;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for quote number generation
CREATE TRIGGER set_quote_number 
    BEFORE INSERT ON quotes 
    FOR EACH ROW 
    EXECUTE FUNCTION generate_quote_number();

-- Update any existing quotes with empty quote numbers
UPDATE quotes 
SET quote_number = 'Q' || TO_CHAR(created_at, 'YYYY') || '-' || LPAD((EXTRACT(EPOCH FROM created_at)::INTEGER % 10000)::TEXT, 4, '0')
WHERE quote_number IS NULL OR quote_number = '';