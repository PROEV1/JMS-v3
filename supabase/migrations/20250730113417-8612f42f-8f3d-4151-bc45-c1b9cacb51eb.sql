-- Add default deposit and warranty settings to admin_settings
INSERT INTO admin_settings (setting_key, setting_value) 
VALUES 
  ('quote_defaults', jsonb_build_object(
    'default_deposit_percentage', 30,
    'default_warranty_period', '5 years'
  ))
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = jsonb_build_object(
    'default_deposit_percentage', 30,
    'default_warranty_period', '5 years'
  );