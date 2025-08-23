-- Add survey token fields to orders table
ALTER TABLE public.orders 
ADD COLUMN survey_token TEXT,
ADD COLUMN survey_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for survey token lookups
CREATE INDEX idx_orders_survey_token ON public.orders(survey_token);

-- Function to generate survey tokens
CREATE OR REPLACE FUNCTION public.generate_survey_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
BEGIN
  LOOP
    -- Generate a random 32-character URL-safe token
    v_token := encode(gen_random_bytes(24), 'base64');
    -- Replace URL-unsafe characters
    v_token := replace(replace(v_token, '+', '-'), '/', '_');
    -- Remove padding
    v_token := rtrim(v_token, '=');
    
    -- Ensure uniqueness
    PERFORM 1 FROM orders WHERE survey_token = v_token;
    IF NOT FOUND THEN
      RETURN v_token;
    END IF;
  END LOOP;
END;
$$;