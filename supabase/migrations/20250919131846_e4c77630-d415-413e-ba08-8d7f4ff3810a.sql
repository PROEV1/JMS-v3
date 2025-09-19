-- Add new order statuses for parts and manual scheduling workflow
-- 1. First, add the new enum values
ALTER TYPE order_status_enhanced ADD VALUE 'awaiting_parts_order';
ALTER TYPE order_status_enhanced ADD VALUE 'awaiting_manual_scheduling';

-- 2. Add parts_ordered field to orders table
ALTER TABLE orders ADD COLUMN parts_ordered boolean DEFAULT false;

-- 3. Update the calculate_order_status_final function to handle the new workflow
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
  deposit_amount NUMERIC;
  has_agreement BOOLEAN;
  payment_required BOOLEAN := true;
  agreement_required BOOLEAN := true;
  deposit_fully_paid BOOLEAN := false;
  active_pending_offers INTEGER := 0;
  accepted_offers INTEGER := 0;
  latest_offer RECORD;
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

  -- Count active pending offers and accepted offers for this order
  SELECT COUNT(*) INTO active_pending_offers
  FROM job_offers 
  WHERE order_id = order_row.id 
    AND status = 'pending' 
    AND expires_at > NOW();

  SELECT COUNT(*) INTO accepted_offers
  FROM job_offers 
  WHERE order_id = order_row.id 
    AND status = 'accepted';

  -- Get the latest offer to check its status
  SELECT * INTO latest_offer
  FROM job_offers
  WHERE order_id = order_row.id
  ORDER BY created_at DESC
  LIMIT 1;

  -- CRITICAL FIX: Check for active offers FIRST before other status logic
  IF active_pending_offers > 0 THEN
    RETURN 'date_offered'::order_status_enhanced;
  END IF;

  IF accepted_offers > 0 THEN
    -- If offer accepted but no scheduled date yet, ready to book
    RETURN 'date_accepted'::order_status_enhanced;
  END IF;

  IF latest_offer.id IS NOT NULL THEN
    IF latest_offer.status = 'rejected' THEN
      RETURN 'date_rejected'::order_status_enhanced;
    ELSIF latest_offer.status = 'expired' THEN
      RETURN 'offer_expired'::order_status_enhanced;
    END IF;
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
  total_amount := COALESCE(order_row.total_amount, 0);
  paid_amount := COALESCE(order_row.amount_paid, 0);
  deposit_amount := COALESCE(order_row.deposit_amount, 0);
  has_agreement := order_row.agreement_signed_at IS NOT NULL;
  
  -- CRITICAL FIX: Check if deposit is fully paid (not full order amount)
  deposit_fully_paid := (deposit_amount > 0 AND paid_amount >= deposit_amount);

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
      
      -- CRITICAL FIX: If payment required and deposit not fully paid, show payment needed
      IF payment_required AND NOT deposit_fully_paid THEN
        RETURN 'awaiting_payment'::order_status_enhanced;
      END IF;

      -- If agreement required and not signed, show agreement needed
      IF agreement_required AND NOT has_agreement THEN
        RETURN 'awaiting_agreement'::order_status_enhanced;
      END IF;

      -- Survey approved and other requirements met, check for new workflow branches
      
      -- NEW: Check if manual scheduling is required
      IF COALESCE(order_row.groundworks_required, false) = true OR 
         COALESCE(order_row.multiple_engineers_required, false) = true OR 
         COALESCE(order_row.specific_engineer_required, false) = true THEN
        RETURN 'awaiting_manual_scheduling'::order_status_enhanced;
      END IF;
      
      -- NEW: Check if parts are required
      IF COALESCE(order_row.part_required, false) = true THEN
        -- For standard quotes, go straight to parts order status
        -- For custom quotes, wait until partner confirms (AWAITING_INSTALL_DATE status)
        IF order_row.quote_type = 'standard' THEN
          IF COALESCE(order_row.parts_ordered, false) = false THEN
            RETURN 'awaiting_parts_order'::order_status_enhanced;
          END IF;
        ELSIF order_row.quote_type = 'custom' THEN
          -- Custom quote: check partner status
          IF order_row.partner_status = 'AWAITING_INSTALL_DATE' THEN
            IF COALESCE(order_row.parts_ordered, false) = false THEN
              RETURN 'awaiting_parts_order'::order_status_enhanced;
            END IF;
          ELSE
            -- Custom quote not yet confirmed, stay in booking status
            RETURN 'awaiting_install_booking'::order_status_enhanced;
          END IF;
        END IF;
      END IF;

      -- Survey approved and other requirements met, ready for scheduling
      RETURN 'awaiting_install_booking'::order_status_enhanced;
    ELSE
      -- draft or unknown -> still waiting on submission
      RETURN 'awaiting_survey_submission'::order_status_enhanced;
    END IF;
  END IF;

  -- After survey gating (or if survey not required), check payment and agreement requirements
  IF payment_required AND NOT deposit_fully_paid THEN
    RETURN 'awaiting_payment'::order_status_enhanced;
  END IF;

  IF agreement_required AND NOT has_agreement THEN
    RETURN 'awaiting_agreement'::order_status_enhanced;
  END IF;

  -- NEW: Check if manual scheduling is required (no survey requirement)
  IF COALESCE(order_row.groundworks_required, false) = true OR 
     COALESCE(order_row.multiple_engineers_required, false) = true OR 
     COALESCE(order_row.specific_engineer_required, false) = true THEN
    RETURN 'awaiting_manual_scheduling'::order_status_enhanced;
  END IF;
  
  -- NEW: Check if parts are required (no survey requirement)
  IF COALESCE(order_row.part_required, false) = true THEN
    -- For standard quotes, go straight to parts order status
    -- For custom quotes, wait until partner confirms (AWAITING_INSTALL_DATE status)
    IF order_row.quote_type = 'standard' THEN
      IF COALESCE(order_row.parts_ordered, false) = false THEN
        RETURN 'awaiting_parts_order'::order_status_enhanced;
      END IF;
    ELSIF order_row.quote_type = 'custom' THEN
      -- Custom quote: check partner status
      IF order_row.partner_status = 'AWAITING_INSTALL_DATE' THEN
        IF COALESCE(order_row.parts_ordered, false) = false THEN
          RETURN 'awaiting_parts_order'::order_status_enhanced;
        END IF;
      ELSE
        -- Custom quote not yet confirmed, stay in booking status
        RETURN 'awaiting_install_booking'::order_status_enhanced;
      END IF;
    END IF;
  END IF;

  -- All requirements met, ready for scheduling
  RETURN 'awaiting_install_booking'::order_status_enhanced;
END;
$function$;

-- 4. Update the status counts function to include the new statuses
CREATE OR REPLACE FUNCTION public.get_schedule_status_counts_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
AS $function$
DECLARE
  needs_scheduling_count INTEGER;
  date_offered_count INTEGER;
  ready_to_book_count INTEGER;
  date_rejected_count INTEGER;
  offer_expired_count INTEGER;
  scheduled_today_count INTEGER;
  scheduled_count INTEGER;
  completion_pending_count INTEGER;
  completed_count INTEGER;
  cancelled_count INTEGER;
  on_hold_count INTEGER;
  unavailable_engineers_count INTEGER;
  awaiting_parts_order_count INTEGER;
  awaiting_manual_scheduling_count INTEGER;
BEGIN
  -- Count orders that need scheduling (awaiting_install_booking status)
  SELECT COUNT(*) INTO needs_scheduling_count
  FROM orders
  WHERE status_enhanced = 'awaiting_install_booking';

  -- Count orders with date offered (pending offers that haven't expired)
  SELECT COUNT(*) INTO date_offered_count
  FROM orders
  WHERE status_enhanced = 'date_offered';

  -- Count orders ready to book (accepted offers, no scheduled date yet)
  SELECT COUNT(*) INTO ready_to_book_count
  FROM orders
  WHERE status_enhanced = 'date_accepted';

  -- Count orders with rejected dates
  SELECT COUNT(*) INTO date_rejected_count
  FROM orders
  WHERE status_enhanced = 'date_rejected';

  -- Count orders with expired offers
  SELECT COUNT(*) INTO offer_expired_count
  FROM orders
  WHERE status_enhanced = 'offer_expired';

  -- Count scheduled installations for today
  SELECT COUNT(*) INTO scheduled_today_count
  FROM orders
  WHERE status_enhanced = 'scheduled'
    AND scheduled_install_date::date = CURRENT_DATE;

  -- Count all scheduled installations (future and today)
  SELECT COUNT(*) INTO scheduled_count
  FROM orders
  WHERE status_enhanced = 'scheduled';

  -- Count completion pending
  SELECT COUNT(*) INTO completion_pending_count
  FROM orders
  WHERE status_enhanced = 'install_completed_pending_qa';

  -- Count completed orders
  SELECT COUNT(*) INTO completed_count
  FROM orders
  WHERE status_enhanced = 'completed';

  -- Count cancelled orders
  SELECT COUNT(*) INTO cancelled_count
  FROM orders
  WHERE status_enhanced = 'cancelled';

  -- Count on-hold orders
  SELECT COUNT(*) INTO on_hold_count
  FROM orders
  WHERE status_enhanced = 'on_hold_parts_docs';

  -- Count orders awaiting parts order
  SELECT COUNT(*) INTO awaiting_parts_order_count
  FROM orders
  WHERE status_enhanced = 'awaiting_parts_order';

  -- Count orders awaiting manual scheduling
  SELECT COUNT(*) INTO awaiting_manual_scheduling_count
  FROM orders
  WHERE status_enhanced = 'awaiting_manual_scheduling';

  -- Count unavailable engineers (placeholder for now)
  unavailable_engineers_count := 0;

  -- Return all counts as JSON
  RETURN jsonb_build_object(
    'needsScheduling', needs_scheduling_count,
    'dateOffered', date_offered_count,
    'readyToBook', ready_to_book_count,
    'dateRejected', date_rejected_count,
    'offerExpired', offer_expired_count,
    'scheduledToday', scheduled_today_count,
    'scheduled', scheduled_count,
    'completionPending', completion_pending_count,
    'completed', completed_count,
    'cancelled', cancelled_count,
    'onHold', on_hold_count,
    'unavailableEngineers', unavailable_engineers_count,
    'awaitingPartsOrder', awaiting_parts_order_count,
    'awaitingManualScheduling', awaiting_manual_scheduling_count
  );
END;
$function$;