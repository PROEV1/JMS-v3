-- Drop the existing trigger first
DROP TRIGGER IF EXISTS update_order_status_enhanced_trigger ON orders;

-- Update the calculate_order_status function to properly handle offers
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
      RETURN 'date_accepted'::order_status_enhanced;
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

-- Create new trigger function that uses the updated logic
CREATE OR REPLACE FUNCTION public.update_order_status_enhanced_with_offers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.status_enhanced := public.calculate_order_status_with_offers(NEW);
  RETURN NEW;
END;
$function$;

-- Add the new trigger
CREATE TRIGGER update_order_status_enhanced_trigger 
  BEFORE INSERT OR UPDATE ON orders 
  FOR EACH ROW 
  EXECUTE FUNCTION update_order_status_enhanced_with_offers();

-- Also create a trigger on job_offers to update order status when offers change
CREATE OR REPLACE FUNCTION public.update_order_status_on_offer_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  order_record orders;
BEGIN
  -- Get the order record
  SELECT * INTO order_record FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  IF FOUND THEN
    -- Update the order's status_enhanced
    UPDATE orders 
    SET status_enhanced = public.calculate_order_status_with_offers(order_record),
        updated_at = NOW()
    WHERE id = order_record.id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER update_order_status_on_offer_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON job_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_offer_change();