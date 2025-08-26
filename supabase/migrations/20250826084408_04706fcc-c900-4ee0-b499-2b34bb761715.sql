-- Add foreign key constraint between inventory_items and inventory_suppliers
ALTER TABLE inventory_items 
ADD CONSTRAINT fk_inventory_items_supplier 
FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id);