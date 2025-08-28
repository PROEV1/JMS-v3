-- Remove the unique constraint for charger names to allow duplicates
DROP INDEX IF EXISTS idx_inventory_items_charger_name_unique;