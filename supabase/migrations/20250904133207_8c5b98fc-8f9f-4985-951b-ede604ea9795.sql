-- Update the specific order to have the correct status
UPDATE orders 
SET 
  status_enhanced = 'date_offered',
  manual_status_override = false,
  updated_at = now()
WHERE id = '5b609a0e-8036-48df-89ff-9a545cddec66';