-- Add unique index on partner_id and partner_external_id to prevent duplicates
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_partner_external_unique 
ON public.orders (partner_id, partner_external_id) 
WHERE partner_id IS NOT NULL AND partner_external_id IS NOT NULL;