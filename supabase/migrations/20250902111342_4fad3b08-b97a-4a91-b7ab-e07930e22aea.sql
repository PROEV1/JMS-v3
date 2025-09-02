-- Fix the deferrable unique constraint issue
-- Drop the existing deferrable constraint and create a proper unique index
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_partner_id_partner_external_id_key;

-- Create a non-deferrable unique index instead
CREATE UNIQUE INDEX IF NOT EXISTS orders_partner_external_unique_idx 
ON orders (partner_id, partner_external_id) 
WHERE partner_external_id IS NOT NULL;