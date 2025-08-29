-- Fix foreign key constraint for inventory_items to reference inventory_suppliers
-- First drop the existing foreign key constraint
ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_supplier_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE inventory_items 
ADD CONSTRAINT inventory_items_supplier_id_fkey 
FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id);