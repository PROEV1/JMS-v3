-- Fix orders stuck in wrong status due to manual override preventing status updates
-- This affects orders that have accepted offers but are stuck due to manual_status_override=true

UPDATE orders 
SET 
  manual_status_override = false,
  manual_status_notes = null,
  updated_at = now()
WHERE id IN (
  -- Find orders that have accepted offers but are stuck with manual override
  SELECT DISTINCT o.id 
  FROM orders o
  JOIN job_offers jo ON jo.order_id = o.id
  WHERE jo.status = 'accepted'
    AND o.manual_status_override = true
    AND o.status_enhanced NOT IN ('awaiting_install_booking', 'scheduled', 'in_progress', 'completed')
);