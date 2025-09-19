-- Hard delete chargers except specified SKUs and clear assignment data (fixed)

-- First, let's see what we're working with (this is just for logging)
DO $$
DECLARE
  total_charger_models INTEGER;
  total_charger_units INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_charger_models FROM inventory_items WHERE is_charger = true;
  SELECT COUNT(*) INTO total_charger_units FROM charger_inventory;
  
  RAISE NOTICE 'Starting cleanup: % charger models, % charger units', total_charger_models, total_charger_units;
END $$;

-- Clear assignment data first to avoid foreign key issues
-- Update any orders that reference chargers we're about to delete
UPDATE charger_inventory 
SET assigned_order_id = NULL, 
    engineer_id = NULL,
    status = 'available',
    notes = NULL
WHERE charger_item_id NOT IN (
  SELECT id FROM inventory_items 
  WHERE is_charger = true 
  AND sku IN ('EPod88766566', 'CHARGER-1756421240306', 'CHARGER-1756421266154')
);

-- Delete charger dispatches for chargers we're removing
DELETE FROM charger_dispatches 
WHERE charger_item_id NOT IN (
  SELECT id FROM inventory_items 
  WHERE is_charger = true 
  AND sku IN ('EPod88766566', 'CHARGER-1756421240306', 'CHARGER-1756421266154')
);

-- Delete charger change logs for chargers we're removing (fixed ambiguous column reference)
DELETE FROM charger_change_log 
WHERE original_charger_id NOT IN (
  SELECT ci.id FROM charger_inventory ci
  JOIN inventory_items ii ON ci.charger_item_id = ii.id
  WHERE ii.is_charger = true 
  AND ii.sku IN ('EPod88766566', 'CHARGER-1756421240306', 'CHARGER-1756421266154')
) OR new_charger_id NOT IN (
  SELECT ci.id FROM charger_inventory ci
  JOIN inventory_items ii ON ci.charger_item_id = ii.id
  WHERE ii.is_charger = true 
  AND ii.sku IN ('EPod88766566', 'CHARGER-1756421240306', 'CHARGER-1756421266154')
);

-- Delete engineer materials used records for chargers we're removing
DELETE FROM engineer_materials_used 
WHERE charger_inventory_id NOT IN (
  SELECT ci.id FROM charger_inventory ci
  JOIN inventory_items ii ON ci.charger_item_id = ii.id
  WHERE ii.is_charger = true 
  AND ii.sku IN ('EPod88766566', 'CHARGER-1756421240306', 'CHARGER-1756421266154')
);

-- Delete charger inventory units for models we're not keeping
DELETE FROM charger_inventory 
WHERE charger_item_id NOT IN (
  SELECT id FROM inventory_items 
  WHERE is_charger = true 
  AND sku IN ('EPod88766566', 'CHARGER-1756421240306', 'CHARGER-1756421266154')
);

-- Delete charger models (inventory_items) we're not keeping
DELETE FROM inventory_items 
WHERE is_charger = true 
AND sku NOT IN ('EPod88766566', 'CHARGER-1756421240306', 'CHARGER-1756421266154');

-- Final count for verification
DO $$
DECLARE
  remaining_charger_models INTEGER;
  remaining_charger_units INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_charger_models FROM inventory_items WHERE is_charger = true;
  SELECT COUNT(*) INTO remaining_charger_units FROM charger_inventory;
  
  RAISE NOTICE 'Cleanup complete: % charger models remaining, % charger units remaining', remaining_charger_models, remaining_charger_units;
END $$;