-- Fix the generate_client_token function
DROP FUNCTION IF EXISTS public.generate_client_token();

CREATE OR REPLACE FUNCTION public.generate_client_token()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    PERFORM 1 FROM job_offers WHERE client_token = v_token;
    IF NOT FOUND THEN
      RETURN v_token;
    END IF;
  END LOOP;
END;
$function$;

-- Insert default offer configuration if it doesn't exist
INSERT INTO admin_settings (setting_key, setting_value)
VALUES ('offer_config', '{
  "default_ttl_hours": 24,
  "auto_fallback_email": true,
  "templates": {
    "email_body": "We have an installation slot available for your order {{order_number}} on {{offered_date}} with engineer {{engineer_name}}. Please use the link below to accept or reject this offer."
  }
}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;