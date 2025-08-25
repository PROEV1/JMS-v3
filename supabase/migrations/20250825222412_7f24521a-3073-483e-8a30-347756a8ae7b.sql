-- Fix the core issue: orders with scheduled_install_date should NEVER be 'offer_expired'
-- The status calculation should prioritize actual scheduling over offer status

-- Update the status calculation function to handle this case properly
CREATE OR REPLACE FUNCTION public.calculate_order_status_final(order_row orders)
RETURNS order_status_enhanced
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  base_status order_status_enhanced;
  latest_survey RECORD;
  survey_required_for_order BOOLEAN := true;
  total_amount NUMERIC;
  paid_amount NUMERIC;
  has_agreement BOOLEAN;
  payment_required BOOLEAN := true;
  agreement_required BOOLEAN := true;
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

  -- CRITICAL FIX: If we have a scheduled install date, we should be 'scheduled' or later, NOT 'offer_expired'
  IF order_row.scheduled_install_date IS NOT NULL THEN
    -- Check if engineer has signed off
    IF order_row.engineer_signed_off_at IS NOT NULL THEN
      IF order_row.status = 'completed' THEN
        RETURN 'completed'::order_status_enhanced;
      ELSE
        RETURN 'install_completed_pending_qa'::order_status_enhanced;
      END IF;
    END IF;
    
    -- Check if install date has passed (should be in progress)
    IF order_row.scheduled_install_date::date < CURRENT_DATE THEN
      RETURN 'in_progress'::order_status_enhanced;
    END IF;
    
    -- Still scheduled for future
    RETURN 'scheduled'::order_status_enhanced;
  END IF;

  -- Partner confirms install date but we don't have one set yet
  IF order_row.partner_status = 'INSTALL_DATE_CONFIRMED' THEN
    RETURN 'scheduled'::order_status_enhanced;
  END IF;

  -- Determine if survey is required for this order (default true unless disabled)
  survey_required_for_order := COALESCE(order_row.survey_required, true);

  -- For partner jobs, partner setting overrides order-level setting if provided
  IF order_row.is_partner_job IS TRUE AND order_row.partner_id IS NOT NULL THEN
    SELECT COALESCE(client_survey_required, true) INTO survey_required_for_order
    FROM public.partners
    WHERE id = order_row.partner_id;

    IF survey_required_for_order IS FALSE THEN
      survey_required_for_order := false;
    END IF;
  END IF;

  -- Get payment and agreement requirements
  total_amount := order_row.total_amount;
  paid_amount := order_row.amount_paid;
  has_agreement := order_row.agreement_signed_at IS NOT NULL;

  -- Read partner flags (default true) only for partner jobs
  IF order_row.is_partner_job IS TRUE AND order_row.partner_id IS NOT NULL THEN
    SELECT
      COALESCE(client_payment_required, true),
      COALESCE(client_agreement_required, true)
    INTO payment_required, agreement_required
    FROM public.partners
    WHERE id = order_row.partner_id;
  END IF;

  -- SURVEY GATING FIRST (only before scheduling and only if survey is required)
  IF survey_required_for_order IS TRUE THEN
    SELECT * INTO latest_survey
    FROM public.client_surveys
    WHERE order_id = order_row.id
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN 'awaiting_survey_submission'::order_status_enhanced;
    END IF;

    IF latest_survey.status = 'rework_requested'::public.survey_status THEN
      RETURN 'survey_rework_requested'::order_status_enhanced;
    ELSIF latest_survey.status IN ('submitted'::public.survey_status, 'under_review'::public.survey_status, 'resubmitted'::public.survey_status) THEN
      RETURN 'awaiting_survey_review'::order_status_enhanced;
    ELSIF latest_survey.status = 'approved'::public.survey_status THEN
      -- Survey is approved, now check what's needed next
      
      -- If payment required and not paid, show payment needed
      IF payment_required AND paid_amount < total_amount THEN
        RETURN 'awaiting_payment'::order_status_enhanced;
      END IF;

      -- If agreement required and not signed, show agreement needed
      IF agreement_required AND NOT has_agreement THEN
        RETURN 'awaiting_agreement'::order_status_enhanced;
      END IF;

      -- Survey approved and other requirements met, ready for scheduling
      RETURN 'awaiting_install_booking'::order_status_enhanced;
    ELSE
      -- draft or unknown -> still waiting on submission
      RETURN 'awaiting_survey_submission'::order_status_enhanced;
    END IF;
  END IF;

  -- After survey gating (or if survey not required), fall back to base logic
  base_status := public.calculate_order_status_with_offers(order_row);
  RETURN base_status;
END;
$function$;