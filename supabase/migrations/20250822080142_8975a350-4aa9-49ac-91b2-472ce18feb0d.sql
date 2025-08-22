-- Allow client_id and quote_id to be NULL for partner jobs
-- First, let's make client_id nullable for partner jobs
ALTER TABLE orders ALTER COLUMN client_id DROP NOT NULL;

-- Also make quote_id nullable for partner jobs
ALTER TABLE orders ALTER COLUMN quote_id DROP NOT NULL;

-- Add a check constraint to ensure non-partner jobs still require these fields
ALTER TABLE orders ADD CONSTRAINT orders_client_quote_required_for_non_partner 
  CHECK (
    (is_partner_job = true) OR 
    (is_partner_job = false AND client_id IS NOT NULL AND quote_id IS NOT NULL) OR
    (is_partner_job IS NULL AND client_id IS NOT NULL AND quote_id IS NOT NULL)
  );