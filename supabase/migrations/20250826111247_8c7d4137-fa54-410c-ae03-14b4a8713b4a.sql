-- Update admin settings to enable strict service area matching
UPDATE admin_settings 
SET setting_value = jsonb_set(
  setting_value,
  '{require_service_area_match}',  
  'true'::jsonb
)
WHERE setting_key = 'scheduling_rules';