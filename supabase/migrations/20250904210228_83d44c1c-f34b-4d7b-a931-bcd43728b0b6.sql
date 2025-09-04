-- Add proper foreign key constraint for engineer_id in purchase_orders table
ALTER TABLE purchase_orders 
ADD CONSTRAINT fk_purchase_orders_engineer 
FOREIGN KEY (engineer_id) REFERENCES engineers(id) ON DELETE SET NULL;