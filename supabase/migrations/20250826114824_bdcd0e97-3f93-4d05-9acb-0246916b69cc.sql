-- Fix orders stuck in wrong status due to manual override preventing status updates
-- This affects orders that have accepted offers but are stuck due to manual_status_override=true

-- First, find and fix orders with accepted offers that are stuck due to manual override
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

-- Log this fix action for audit purposes
INSERT INTO order_activity (order_id, activity_type, description, details, created_by)
SELECT 
  o.id,
  'status_override_cleared',
  'Manual status override cleared to allow proper status calculation for accepted offers',
  jsonb_build_object(
    'reason', 'accepted_offer_status_fix',
    'previous_override', true,
    'accepted_offer_count', (
      SELECT COUNT(*) 
      FROM job_offers jo2 
      WHERE jo2.order_id = o.id AND jo2.status = 'accepted'
    )
  ),
  '00000000-0000-0000-0000-000000000000'::uuid -- System user
FROM orders o
JOIN job_offers jo ON jo.order_id = o.id
WHERE jo.status = 'accepted'
  AND o.manual_status_override = false  -- These were just updated above
  AND o.order_number = 'ORD2024-2208'; -- Specifically log for the reported order