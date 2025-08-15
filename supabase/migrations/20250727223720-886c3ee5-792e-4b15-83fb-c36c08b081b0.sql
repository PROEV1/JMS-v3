-- Add engineer_status field to track engineer-specific progress
ALTER TABLE orders ADD COLUMN engineer_status text;

-- Update existing orders to have a default engineer status based on their current state
UPDATE orders 
SET engineer_status = CASE 
  WHEN status_enhanced = 'in_progress' OR scheduled_install_date IS NOT NULL THEN 'scheduled'
  WHEN engineer_signed_off_at IS NOT NULL THEN 'completed'
  ELSE 'scheduled'
END
WHERE engineer_id IS NOT NULL;