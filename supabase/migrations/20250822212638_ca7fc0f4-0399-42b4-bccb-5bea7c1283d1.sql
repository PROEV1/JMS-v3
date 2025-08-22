-- Temporarily disable the trigger and force update the status_enhanced values
-- This ensures no trigger interference

-- Disable the trigger temporarily
DROP TRIGGER IF EXISTS orders_before_set_status_enhanced ON public.orders;

-- Force update all partner job statuses directly
UPDATE orders 
SET status_enhanced = (
  CASE 
    -- Manual override takes precedence
    WHEN manual_status_override IS TRUE AND status_enhanced IS NOT NULL THEN status_enhanced
    
    -- Partner On Hold (or explicit suppression) takes precedence  
    WHEN (scheduling_suppressed IS TRUE) OR (partner_status IN ('ON_HOLD','SWITCH_JOB_SUB_TYPE_REQUESTED','WAITING_FOR_OHME_APPROVAL')) 
    THEN 'on_hold_parts_docs'::order_status_enhanced
    
    -- Partner Installed / Completion Pending => Completion Pending bucket
    WHEN partner_status IN ('INSTALLED','COMPLETION_PENDING') 
    THEN 'install_completed_pending_qa'::order_status_enhanced
    
    -- Partner Cancelled or Cancellation Requested => Cancelled
    WHEN partner_status IN ('CANCELLED','CANCELLATION_REQUESTED') 
    THEN 'cancelled'::order_status_enhanced
    
    -- If partner confirms install date and we have one, treat as scheduled
    WHEN partner_status = 'INSTALL_DATE_CONFIRMED' AND scheduled_install_date IS NOT NULL 
    THEN 'scheduled'::order_status_enhanced
    
    -- For other cases, keep the current value or set to awaiting_install_booking
    ELSE 'awaiting_install_booking'::order_status_enhanced
  END
),
updated_at = NOW()
WHERE is_partner_job = true;

-- Re-enable the trigger
CREATE TRIGGER orders_before_set_status_enhanced
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_set_status_enhanced();