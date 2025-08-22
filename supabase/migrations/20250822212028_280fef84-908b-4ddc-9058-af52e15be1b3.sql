
-- 1) Recreate calculate_order_status_final with explicit partner_status mapping
CREATE OR REPLACE FUNCTION public.calculate_order_status_final(order_row orders)
RETURNS order_status_enhanced
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  -- Respect manual override
  IF order_row.manual_status_override IS TRUE AND order_row.status_enhanced IS NOT NULL THEN
    RETURN order_row.status_enhanced;
  END IF;

  -- Partner On Hold (or explicit suppression) takes precedence
  IF (order_row.scheduling_suppressed IS TRUE)
     OR (order_row.partner_status IN ('ON_HOLD','SWITCH_JOB_SUB_TYPE_REQUESTED','WAITING_FOR_OHME_APPROVAL')) THEN
    RETURN 'on_hold_parts_docs'::order_status_enhanced;
  END IF;

  -- Partner Installed / Completion Pending => Completion Pending bucket
  IF order_row.partner_status IN ('INSTALLED','COMPLETION_PENDING') THEN
    RETURN 'install_completed_pending_qa'::order_status_enhanced;
  END IF;

  -- Partner Cancelled or Cancellation Requested => Cancelled
  IF order_row.partner_status IN ('CANCELLED','CANCELLATION_REQUESTED') THEN
    RETURN 'cancelled'::order_status_enhanced;
  END IF;

  -- If partner confirms install date and we have one, treat as scheduled
  IF order_row.partner_status = 'INSTALL_DATE_CONFIRMED'
     AND order_row.scheduled_install_date IS NOT NULL THEN
    RETURN 'scheduled'::order_status_enhanced;
  END IF;

  -- Fall back to existing logic that considers offers, payment, agreement, date, etc.
  RETURN public.calculate_order_status_with_offers(order_row);
END;
$function$;

-- 2) Ensure offer-change handler uses the final calculator (not just offers-only)
CREATE OR REPLACE FUNCTION public.update_order_status_on_offer_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  order_record orders;
BEGIN
  SELECT * INTO order_record FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  IF FOUND THEN
    UPDATE orders 
    SET status_enhanced = public.calculate_order_status_final(order_record),
        updated_at = NOW()
    WHERE id = order_record.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 3) Repair/Create missing triggers

-- Orders: set status_enhanced before write
DROP TRIGGER IF EXISTS orders_before_set_status_enhanced ON public.orders;
CREATE TRIGGER orders_before_set_status_enhanced
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.trg_set_status_enhanced();

-- Orders: maintain updated_at
DROP TRIGGER IF EXISTS orders_update_updated_at ON public.orders;
CREATE TRIGGER orders_update_updated_at
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Orders: generate order number on insert
DROP TRIGGER IF EXISTS orders_generate_order_number ON public.orders;
CREATE TRIGGER orders_generate_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- Orders: log status changes
DROP TRIGGER IF EXISTS orders_log_status_change ON public.orders;
CREATE TRIGGER orders_log_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- Orders: expire pending offers when order reset/unassigned
DROP TRIGGER IF EXISTS orders_expire_offers_on_reset ON public.orders;
CREATE TRIGGER orders_expire_offers_on_reset
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.expire_offers_on_order_reset();

-- Job offers: recalc order status on any change
DROP TRIGGER IF EXISTS job_offers_update_order_status ON public.job_offers;
CREATE TRIGGER job_offers_update_order_status
AFTER INSERT OR UPDATE OR DELETE ON public.job_offers
FOR EACH ROW EXECUTE FUNCTION public.update_order_status_on_offer_change();

-- 4) Backfill: recalculate status_enhanced for all existing orders
UPDATE public.orders o
SET status_enhanced = public.calculate_order_status_final(o);
