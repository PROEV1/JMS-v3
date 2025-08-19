-- Fix calculate_order_status to treat "today" as scheduled (not in_progress)
CREATE OR REPLACE FUNCTION public.calculate_order_status(
  p_quote_status text,
  p_agreement_signed_at timestamp with time zone,
  p_scheduled_install_date date,
  p_engineer_signed_off boolean,
  p_amount_paid numeric,
  p_total_amount numeric,
  p_has_active_offers boolean DEFAULT false,
  p_last_offer_status text DEFAULT null,
  p_last_offer_expires_at timestamp with time zone DEFAULT null
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  payment_completed boolean;
  install_date_passed boolean;
BEGIN
  -- Null safety
  p_quote_status := COALESCE(p_quote_status, 'draft');
  p_engineer_signed_off := COALESCE(p_engineer_signed_off, false);
  p_amount_paid := COALESCE(p_amount_paid, 0);
  p_total_amount := COALESCE(p_total_amount, 0);
  p_has_active_offers := COALESCE(p_has_active_offers, false);

  -- Early returns for draft/sent quotes
  IF p_quote_status IN ('draft', 'sent') THEN
    RETURN 'needs_quote_acceptance';
  END IF;

  -- Payment check
  payment_completed := p_amount_paid >= p_total_amount;
  
  -- Date comparison: only consider past dates as "passed" (not today)
  install_date_passed := p_scheduled_install_date IS NOT NULL 
    AND p_scheduled_install_date::date < CURRENT_DATE;

  -- Handle incomplete payment
  IF NOT payment_completed THEN
    RETURN 'awaiting_payment';
  END IF;

  -- Handle missing agreement
  IF p_agreement_signed_at IS NULL THEN
    RETURN 'awaiting_agreement';
  END IF;

  -- Engineer has signed off - job is done pending QA
  IF p_engineer_signed_off THEN
    RETURN 'install_completed_pending_qa';
  END IF;

  -- Handle scheduling states
  IF p_scheduled_install_date IS NULL THEN
    -- Check offer status
    IF p_has_active_offers THEN
      IF p_last_offer_status = 'pending' AND p_last_offer_expires_at IS NOT NULL THEN
        IF p_last_offer_expires_at > NOW() THEN
          RETURN 'date_offered';
        ELSE
          RETURN 'offer_expired';
        END IF;
      ELSIF p_last_offer_status = 'accepted' THEN
        RETURN 'date_accepted';
      ELSIF p_last_offer_status = 'rejected' THEN
        RETURN 'date_rejected';
      END IF;
    END IF;
    
    RETURN 'needs_scheduling';
  END IF;

  -- Install date is scheduled
  IF install_date_passed THEN
    -- Date has passed, work should be in progress
    RETURN 'in_progress';
  ELSE
    -- Date is today or future, still scheduled
    RETURN 'scheduled';
  END IF;
END;
$function$;