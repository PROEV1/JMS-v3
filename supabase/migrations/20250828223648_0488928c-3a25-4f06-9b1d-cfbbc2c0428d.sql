-- First, identify and merge duplicate charger models
-- We'll keep the first record for each duplicate name and merge the units

-- Create a temporary table to store the primary record for each charger name
CREATE TEMP TABLE charger_primaries AS
SELECT 
  name,
  MIN(id) as primary_id
FROM inventory_items 
WHERE is_charger = true 
GROUP BY name 
HAVING COUNT(*) > 1;

-- Update any charger_inventory records that reference duplicate charger models
-- to point to the primary record instead
UPDATE charger_inventory 
SET charger_item_id = cp.primary_id
FROM charger_primaries cp
WHERE charger_item_id IN (
  SELECT ii.id 
  FROM inventory_items ii 
  WHERE ii.is_charger = true 
    AND ii.name = cp.name 
    AND ii.id != cp.primary_id
);

-- Update any purchase order lines that reference duplicate charger models
UPDATE purchase_order_lines 
SET item_id = cp.primary_id
FROM charger_primaries cp
WHERE item_id IN (
  SELECT ii.id 
  FROM inventory_items ii 
  WHERE ii.is_charger = true 
    AND ii.name = cp.name 
    AND ii.id != cp.primary_id
);

-- Update any inventory transactions that reference duplicate charger models
UPDATE inventory_txns 
SET item_id = cp.primary_id
FROM charger_primaries cp
WHERE item_id IN (
  SELECT ii.id 
  FROM inventory_items ii 
  WHERE ii.is_charger = true 
    AND ii.name = cp.name 
    AND ii.id != cp.primary_id
);

-- Delete the duplicate charger model records (keeping only the primary ones)
DELETE FROM inventory_items 
WHERE is_charger = true 
  AND id IN (
    SELECT ii.id 
    FROM inventory_items ii
    JOIN charger_primaries cp ON ii.name = cp.name
    WHERE ii.id != cp.primary_id
  );

-- Now add the unique constraint for charger names
-- We'll use a partial unique index to only apply to charger items
CREATE UNIQUE INDEX idx_inventory_items_charger_name_unique 
ON inventory_items (name) 
WHERE is_charger = true;

-- Add a comment to document this constraint
COMMENT ON INDEX idx_inventory_items_charger_name_unique IS 'Ensures charger model names are unique';

-- Log the cleanup action
INSERT INTO order_activity (
  order_id, 
  activity_type, 
  description, 
  details
) 
SELECT 
  NULL::uuid,
  'system_cleanup',
  'Merged duplicate charger models and added unique constraint',
  jsonb_build_object(
    'action', 'charger_name_uniqueness_enforcement',
    'timestamp', now(),
    'duplicates_found', (SELECT COUNT(*) FROM charger_primaries)
  )
WHERE EXISTS (SELECT 1 FROM charger_primaries);