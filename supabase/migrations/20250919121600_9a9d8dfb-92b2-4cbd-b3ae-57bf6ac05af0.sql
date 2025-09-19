-- Clear all assignment data from remaining chargers

-- Update all remaining charger inventory to clear assignments
UPDATE charger_inventory 
SET 
  assigned_order_id = NULL,
  engineer_id = NULL,
  status = 'available',
  notes = NULL,
  updated_at = now()
WHERE assigned_order_id IS NOT NULL 
   OR engineer_id IS NOT NULL 
   OR status != 'available';

-- Report what was updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % charger inventory records to clear assignment data', updated_count;
END $$;