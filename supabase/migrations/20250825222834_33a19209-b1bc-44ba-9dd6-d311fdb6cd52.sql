-- Force all orders to recalculate their status_enhanced using the new logic
-- This will fix the issue where scheduled orders were showing as offer_expired

UPDATE orders 
SET updated_at = now()
WHERE scheduled_install_date IS NOT NULL AND status_enhanced = 'offer_expired';

-- Also force update for all other orders that might be affected
UPDATE orders 
SET updated_at = now()
WHERE status_enhanced IN ('offer_expired', 'date_offered', 'scheduled');