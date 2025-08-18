-- Update admin_settings offer_config to include app_base_url and from_address
UPDATE admin_settings 
SET setting_value = jsonb_set(
  jsonb_set(
    setting_value,
    '{app_base_url}',
    '"https://proev-installers.lovable.app"'
  ),
  '{from_address}',
  '"ProEV Scheduling <no-reply@proev.co.uk>"'
)
WHERE setting_key = 'offer_config';