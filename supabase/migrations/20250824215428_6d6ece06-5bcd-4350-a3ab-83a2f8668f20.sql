
-- Reorder status logic so SURVEY is evaluated BEFORE PAYMENT unless manual override.
-- Keeps existing partner and manual override precedence intact.

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

  -- SURVEY GATING FIRST (only before scheduling and only if survey is required)
  IF order_row.scheduled_install_date IS NULL AND survey_required_for_order IS TRUE THEN
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
      -- Keep as approved until scheduling/payment/next step takes over
      RETURN 'survey_approved'::order_status_enhanced;
    ELSE
      -- draft or unknown -> still waiting on submission
      RETURN 'awaiting_survey_submission'::order_status_enhanced;
    END IF;
  END IF;

  -- After survey gating (or if survey not required / already scheduled), fall back to base logic
  base_status := public.calculate_order_status_with_offers(order_row);
  RETURN base_status;
END;
$function$;
