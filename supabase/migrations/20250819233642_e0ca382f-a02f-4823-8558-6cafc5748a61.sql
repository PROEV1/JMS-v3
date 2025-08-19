-- Fix the status calculation for accepted offers
CREATE OR REPLACE FUNCTION public.calculate_order_status_with_offers(order_row orders)
 RETURNS order_status_enhanced
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  total_amount NUMERIC;
  paid_amount NUMERIC;
  has_agreement BOOLEAN;
  has_install_date BOOLEAN;
  install_date_passed BOOLEAN;
  has_engineer_signoff BOOLEAN;
  payment_required BOOLEAN := true;
  agreement_required BOOLEAN := true;
  active_offer_count INTEGER := 0;
  last_offer RECORD;
BEGIN
  total_amount := order_row.total_amount;
  paid_amount := order_row.amount_paid;
  has_agreement := order_row.agreement_signed_at IS NOT NULL;
  has_install_date := order_row.scheduled_install_date IS NOT NULL;
  install_date_passed := order_row.scheduled_install_date IS NOT NULL AND order_row.scheduled_install_date < CURRENT_DATE;
  has_engineer_signoff := order_row.engineer_signed_off_at IS NOT NULL;

  -- Read partner flags (default true) only for partner jobs
  IF order_row.is_partner_job IS TRUE AND order_row.partner_id IS NOT NULL THEN
    SELECT
      COALESCE(client_payment_required, true),
      COALESCE(client_agreement_required, true)
    INTO payment_required, agreement_required
    FROM public.partners
    WHERE id = order_row.partner_id;
  END IF;

  -- Respect manual override if set
  IF order_row.manual_status_override = true AND order_row.status_enhanced IS NOT NULL THEN
    RETURN order_row.status_enhanced;
  END IF;

  -- If payment required, block on payment; otherwise skip
  IF payment_required AND paid_amount < total_amount THEN
    RETURN 'awaiting_payment'::order_status_enhanced;
  END IF;

  -- If agreement required, block on agreement; otherwise skip
  IF agreement_required AND NOT has_agreement THEN
    RETURN 'awaiting_agreement'::order_status_enhanced;
  END IF;

  -- Check for active offers if not scheduled yet
  IF NOT has_install_date THEN
    -- Count active pending offers
    SELECT COUNT(*) INTO active_offer_count
    FROM job_offers
    WHERE order_id = order_row.id 
      AND status = 'pending' 
      AND expires_at > NOW();

    -- Get the latest offer (any status)
    SELECT * INTO last_offer
    FROM job_offers
    WHERE order_id = order_row.id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Determine status based on offers
    IF active_offer_count > 0 THEN
      RETURN 'date_offered'::order_status_enhanced;
    ELSIF last_offer.status = 'accepted' THEN
      -- When offer is accepted, order goes to awaiting_install_booking which shows as "Ready to Book"
      RETURN 'awaiting_install_booking'::order_status_enhanced;
    ELSIF last_offer.status = 'rejected' THEN
      RETURN 'date_rejected'::order_status_enhanced;
    ELSIF last_offer.status = 'expired' THEN
      RETURN 'offer_expired'::order_status_enhanced;
    END IF;
    
    RETURN 'awaiting_install_booking'::order_status_enhanced;
  END IF;

  -- Scheduled and in-progress states
  IF has_install_date AND NOT install_date_passed THEN
    RETURN 'scheduled'::order_status_enhanced;
  END IF;

  IF install_date_passed AND NOT has_engineer_signoff THEN
    RETURN 'in_progress'::order_status_enhanced;
  END IF;

  IF has_engineer_signoff AND order_row.status <> 'completed' THEN
    RETURN 'install_completed_pending_qa'::order_status_enhanced;
  END IF;

  IF order_row.status = 'completed' THEN
    RETURN 'completed'::order_status_enhanced;
  END IF;

  RETURN 'awaiting_install_booking'::order_status_enhanced;
END;
$function$;

-- Force recalculation of all order statuses
UPDATE orders SET updated_at = NOW();