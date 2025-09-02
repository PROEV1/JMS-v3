-- Create unique index for orders to prevent collision issues
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_partner_external_unique 
ON orders (partner_id, partner_external_id) 
WHERE partner_external_id IS NOT NULL;

-- Add comment for clarity
COMMENT ON INDEX idx_orders_partner_external_unique IS 'Ensures unique partner external IDs within a partner to enable upsert operations';