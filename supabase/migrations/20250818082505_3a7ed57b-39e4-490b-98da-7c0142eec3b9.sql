
-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Guarantee unique keys we rely on
CREATE UNIQUE INDEX IF NOT EXISTS admin_settings_setting_key_key ON admin_settings (setting_key);
CREATE UNIQUE INDEX IF NOT EXISTS job_offers_client_token_key ON job_offers (client_token);

-- 2) Create RPC to generate a URL-safe, unique client token
CREATE OR REPLACE FUNCTION generate_client_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_token TEXT;
BEGIN
  LOOP
    -- 24 random bytes -> ~32 char url-safe token
    v_token := encode(gen_random_bytes(24), 'base64url');

    -- Ensure uniqueness against existing offers
    PERFORM 1 FROM job_offers WHERE client_token = v_token;
    IF NOT FOUND THEN
      RETURN v_token;
    END IF;
  END LOOP;
END;
$$;

-- 3) Seed/Upsert offer configuration used by the edge function
INSERT INTO admin_settings (setting_key, setting_value)
VALUES (
  'offer_config',
  '{
    "default_ttl_hours": 24,
    "auto_fallback_email": true,
    "templates": {
      "email_body": "We have an installation slot available for your order {{order_number}} on {{offered_date}} with engineer {{engineer_name}}. Please click the link to accept or reject: {{offer_url}}",
      "sms_body": "Installation slot available for order {{order_number}} on {{offered_date}}. Accept/reject: {{offer_url}}",
      "whatsapp_body": "🔧 Installation slot available for order {{order_number}} on {{offered_date}} with {{engineer_name}}. Accept/reject: {{offer_url}}"
    }
  }'::jsonb
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = now();
