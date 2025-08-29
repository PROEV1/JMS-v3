-- Fix purchase order deletion by updating foreign key constraint to allow cascade delete
-- First drop the existing constraint
ALTER TABLE stock_requests DROP CONSTRAINT IF EXISTS stock_requests_purchase_order_id_fkey;

-- Add the constraint back with CASCADE delete
ALTER TABLE stock_requests 
ADD CONSTRAINT stock_requests_purchase_order_id_fkey 
FOREIGN KEY (purchase_order_id) 
REFERENCES purchase_orders(id) 
ON DELETE SET NULL;