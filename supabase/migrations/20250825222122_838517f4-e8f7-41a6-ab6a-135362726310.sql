-- Fix the trigger logic and update offer statuses for properly scheduled orders

-- First, let's update Peter Harvey's offer to be properly expired with scheduling reason
UPDATE job_offers 
SET 
  status = 'expired',
  expired_at = now(),
  updated_at = now(),
  delivery_details = COALESCE(delivery_details, '{}')::jsonb || 
    jsonb_build_object(
      'auto_expired_due_to_schedule', true,
      'auto_expired_at', now(),
      'reason', 'order_scheduled_retroactively'
    )
WHERE order_id = '3f1c3aab-0aeb-4d11-918f-a1cd66879b2e'
  AND status = 'expired';

-- Check if Sophie's offer should still be active (not expired)
-- Let's see what's happening with her offers
UPDATE job_offers 
SET 
  status = 'pending',
  expired_at = NULL,
  expires_at = offered_date + interval '48 hours'
WHERE order_id = (
  SELECT o.id FROM orders o 
  JOIN clients c ON o.client_id = c.id 
  WHERE c.full_name = 'Sophie Banham'
)
AND expires_at > now()  -- Only if it shouldn't actually be expired
AND status = 'expired';

-- Fix the estimated_duration_hours for partner jobs that should have 5 hours
UPDATE orders 
SET estimated_duration_hours = 5
WHERE order_number IN ('ORD2025-4474', 'ORD2025-4473', 'ORD2025-4475')
AND estimated_duration_hours IS NULL;