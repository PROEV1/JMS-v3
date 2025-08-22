
-- 1) Final status function that prioritizes "On Hold" and respects manual overrides
CREATE OR REPLACE FUNCTION public.calculate_order_status_final(order_row orders)
RETURNS order_status_enhanced
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- If user has manually overridden, keep existing
  IF order_row.manual_status_override IS TRUE AND order_row.status_enhanced IS NOT NULL THEN
    RETURN order_row.status_enhanced;
  END IF;

  -- Partner On Hold (or explicit suppression) takes precedence
  IF (order_row.scheduling_suppressed IS TRUE)
     OR (order_row.partner_status IN ('ON_HOLD','SWITCH_JOB_SUB_TYPE_REQUESTED','WAITING_FOR_OHME_APPROVAL')) THEN
    RETURN 'on_hold_parts_docs'::order_status_enhanced;
  END IF;

  -- Otherwise fall back to existing logic that considers offers, payment, agreement, date, etc.
  RETURN public.calculate_order_status_with_offers(order_row);
END;
$$;

-- 2) Trigger function to set status_enhanced before write
CREATE OR REPLACE FUNCTION public.trg_set_status_enhanced()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Respect manual override
  IF NEW.manual_status_override IS TRUE AND NEW.status_enhanced IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW.status_enhanced := public.calculate_order_status_final(NEW);
  RETURN NEW;
END;
$$;

-- 3) Create triggers (guarded to avoid duplicates)

-- Set status_enhanced on insert/update
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_before_set_status_enhanced') THEN
    CREATE TRIGGER orders_before_set_status_enhanced
    BEFORE INSERT OR UPDATE OF partner_status, scheduled_install_date, engineer_id, amount_paid, total_amount, agreement_signed_at, is_partner_job, partner_id, scheduling_suppressed, manual_status_override
    ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_set_status_enhanced();
  END IF;
END$$;

-- Auto-generate order number
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_generate_order_number') THEN
    CREATE TRIGGER orders_generate_order_number
    BEFORE INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_order_number();
  END IF;
END$$;

-- Maintain updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_set_updated_at') THEN
    CREATE TRIGGER orders_set_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Log status changes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_log_status_change') THEN
    CREATE TRIGGER orders_log_status_change
    AFTER INSERT OR UPDATE OF status_enhanced, status
    ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.log_order_status_change();
  END IF;
END$$;

-- Expire pending offers when order is reset
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_expire_offers_on_reset') THEN
    CREATE TRIGGER orders_expire_offers_on_reset
    AFTER UPDATE OF engineer_id, scheduled_install_date, status_enhanced
    ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.expire_offers_on_order_reset();
  END IF;
END$$;

-- Keep orders in sync when job_offers change
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'job_offers_update_order_status_on_change') THEN
    CREATE TRIGGER job_offers_update_order_status_on_change
    AFTER INSERT OR UPDATE OR DELETE ON public.job_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_order_status_on_offer_change();
  END IF;
END$$;

-- 4) Backfill existing rows so UI buckets update immediately

-- Backfill On Hold
UPDATE public.orders
SET status_enhanced = 'on_hold_parts_docs'
WHERE is_partner_job IS TRUE
  AND (partner_status IN ('ON_HOLD','SWITCH_JOB_SUB_TYPE_REQUESTED','WAITING_FOR_OHME_APPROVAL')
       OR scheduling_suppressed IS TRUE)
  AND (scheduled_install_date IS NULL)
  AND (manual_status_override IS DISTINCT FROM TRUE)
  AND status_enhanced IS DISTINCT FROM 'on_hold_parts_docs';

-- Backfill Completion Pending
UPDATE public.orders
SET status_enhanced = 'install_completed_pending_qa'
WHERE is_partner_job IS TRUE
  AND partner_status IN ('INSTALLED','COMPLETION_PENDING')
  AND (manual_status_override IS DISTINCT FROM TRUE)
  AND status_enhanced IS DISTINCT FROM 'install_completed_pending_qa';
