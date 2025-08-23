-- Update all order statuses to reflect the new survey requirement logic
-- This will cause orders to recalculate their status_enhanced field
UPDATE public.orders 
SET updated_at = now()
WHERE is_partner_job = true;