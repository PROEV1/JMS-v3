-- Fix the remaining deferrable constraint issue
-- Drop the deferrable constraint and create a proper unique index
ALTER TABLE orders DROP CONSTRAINT IF EXISTS unique_partner_job_id;

-- Create a non-deferrable unique index instead
CREATE UNIQUE INDEX IF NOT EXISTS orders_partner_job_unique_idx 
ON orders (partner_id, partner_external_id) 
WHERE partner_id IS NOT NULL AND partner_external_id IS NOT NULL;