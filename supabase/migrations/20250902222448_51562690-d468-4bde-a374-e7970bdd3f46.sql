-- Phase B: Add database indexes for faster import lookups

-- Indexes on clients table for faster email lookups
CREATE INDEX IF NOT EXISTS idx_clients_email_normalized ON clients(email_normalized);
CREATE INDEX IF NOT EXISTS idx_clients_partner_email ON clients(partner_id, email_normalized) WHERE partner_id IS NOT NULL;

-- Indexes on orders table for faster external ID lookups  
CREATE INDEX IF NOT EXISTS idx_orders_partner_external_id ON orders(partner_external_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner_external ON orders(partner_id, partner_external_id) WHERE partner_id IS NOT NULL AND partner_external_id IS NOT NULL;

-- Unique constraint on orders to prevent duplicate partner jobs (improves performance and data integrity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_partner_external_unique 
ON orders(partner_id, partner_external_id) 
WHERE partner_id IS NOT NULL AND partner_external_id IS NOT NULL AND is_partner_job = true;

-- Index on partner_import_logs for faster history queries
CREATE INDEX IF NOT EXISTS idx_partner_import_logs_partner_created ON partner_import_logs(partner_id, created_at DESC);