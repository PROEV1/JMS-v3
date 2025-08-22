-- Remove all competing status triggers and keep only the correct one
DROP TRIGGER IF EXISTS trigger_update_order_status_enhanced ON public.orders;
DROP TRIGGER IF EXISTS update_order_status_enhanced_trigger ON public.orders;
DROP TRIGGER IF EXISTS trigger_log_order_changes ON public.orders;

-- Remove duplicate triggers
DROP TRIGGER IF EXISTS generate_order_number_trigger ON public.orders;
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
DROP TRIGGER IF EXISTS trg_generate_order_number ON public.orders;
DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
DROP TRIGGER IF EXISTS trig_expire_offers_on_order_unassign ON public.orders;
DROP TRIGGER IF EXISTS trigger_expire_offers_on_order_reset ON public.orders;

-- Now force update the status_enhanced values with clean triggers
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
)
WHERE is_partner_job = true;