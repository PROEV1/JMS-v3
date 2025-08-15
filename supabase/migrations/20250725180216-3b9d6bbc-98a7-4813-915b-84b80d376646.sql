-- Update the calculate_order_status function to check for deposit payment completion instead of full payment
CREATE OR REPLACE FUNCTION public.calculate_order_status(order_row orders)
 RETURNS order_status_enhanced
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    total_amount NUMERIC;
    paid_amount NUMERIC;
    deposit_amount NUMERIC;
    has_agreement BOOLEAN;
    has_engineer BOOLEAN;
    has_install_date BOOLEAN;
    install_date_passed BOOLEAN;
    has_engineer_signoff BOOLEAN;
    deposit_complete BOOLEAN;
    payment_complete BOOLEAN;
BEGIN
    -- Get payment information
    total_amount := order_row.total_amount;
    paid_amount := order_row.amount_paid;
    deposit_amount := order_row.deposit_amount;
    
    -- Check if deposit is complete (amount paid >= deposit amount)
    deposit_complete := paid_amount >= deposit_amount;
    
    -- Check if full payment is complete (amount paid >= total amount)
    payment_complete := paid_amount >= total_amount;
    
    -- Check if agreement is signed
    has_agreement := order_row.agreement_signed_at IS NOT NULL;
    
    -- Check if engineer is assigned
    has_engineer := order_row.engineer_id IS NOT NULL;
    
    -- Check if install date is set
    has_install_date := order_row.scheduled_install_date IS NOT NULL;
    
    -- Check if install date has passed
    install_date_passed := order_row.scheduled_install_date IS NOT NULL AND order_row.scheduled_install_date < now();
    
    -- Check if engineer has signed off
    has_engineer_signoff := order_row.engineer_signed_off_at IS NOT NULL;
    
    -- Manual override takes precedence
    IF order_row.manual_status_override = true AND order_row.status_enhanced IS NOT NULL THEN
        RETURN order_row.status_enhanced;
    END IF;
    
    -- Updated status logic - check for deposit completion instead of full payment
    IF NOT deposit_complete THEN
        RETURN 'awaiting_payment'::order_status_enhanced;
    END IF;
    
    IF deposit_complete AND NOT has_agreement THEN
        RETURN 'awaiting_agreement'::order_status_enhanced;
    END IF;
    
    IF has_agreement AND NOT has_install_date THEN
        RETURN 'awaiting_install_booking'::order_status_enhanced;
    END IF;
    
    IF has_install_date AND NOT install_date_passed THEN
        RETURN 'scheduled'::order_status_enhanced;
    END IF;
    
    IF install_date_passed AND NOT has_engineer_signoff THEN
        RETURN 'in_progress'::order_status_enhanced;
    END IF;
    
    IF has_engineer_signoff AND NOT payment_complete THEN
        RETURN 'awaiting_final_payment'::order_status_enhanced;
    END IF;
    
    IF payment_complete AND order_row.status = 'completed' THEN
        RETURN 'completed'::order_status_enhanced;
    END IF;
    
    -- Default fallback
    RETURN 'quote_accepted'::order_status_enhanced;
END;
$function$