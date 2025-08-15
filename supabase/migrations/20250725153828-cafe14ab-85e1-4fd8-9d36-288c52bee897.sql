-- Fix security warnings by adding search_path to functions
CREATE OR REPLACE FUNCTION calculate_order_status(order_row orders)
RETURNS order_status_enhanced
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_amount NUMERIC;
    paid_amount NUMERIC;
    has_agreement BOOLEAN;
    has_engineer BOOLEAN;
    has_install_date BOOLEAN;
    install_date_passed BOOLEAN;
    has_engineer_signoff BOOLEAN;
BEGIN
    -- Get payment information
    total_amount := order_row.total_amount;
    paid_amount := order_row.amount_paid;
    
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
    
    -- Status logic
    IF paid_amount < total_amount THEN
        RETURN 'awaiting_payment'::order_status_enhanced;
    END IF;
    
    IF paid_amount >= total_amount AND NOT has_agreement THEN
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
    
    IF has_engineer_signoff AND order_row.status != 'completed' THEN
        RETURN 'install_completed_pending_qa'::order_status_enhanced;
    END IF;
    
    IF order_row.status = 'completed' THEN
        RETURN 'completed'::order_status_enhanced;
    END IF;
    
    -- Default fallback
    RETURN 'quote_accepted'::order_status_enhanced;
END;
$$;

CREATE OR REPLACE FUNCTION log_order_activity(
    p_order_id UUID,
    p_activity_type TEXT,
    p_description TEXT,
    p_details JSONB DEFAULT '{}',
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO public.order_activity (
        order_id,
        activity_type,
        description,
        details,
        created_by
    ) VALUES (
        p_order_id,
        p_activity_type,
        p_description,
        p_details,
        COALESCE(p_created_by, auth.uid())
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_order_status_enhanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.status_enhanced := calculate_order_status(NEW);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Log status changes
    IF TG_OP = 'UPDATE' AND (OLD.status_enhanced != NEW.status_enhanced OR OLD.status != NEW.status) THEN
        PERFORM log_order_activity(
            NEW.id,
            'status_change',
            CASE 
                WHEN NEW.manual_status_override THEN 'Status manually changed to ' || NEW.status_enhanced
                ELSE 'Status automatically updated to ' || NEW.status_enhanced
            END,
            jsonb_build_object(
                'old_status', OLD.status_enhanced,
                'new_status', NEW.status_enhanced,
                'manual_override', NEW.manual_status_override,
                'notes', NEW.manual_status_notes
            )
        );
    END IF;
    
    -- Log engineer assignment
    IF TG_OP = 'UPDATE' AND OLD.engineer_id IS DISTINCT FROM NEW.engineer_id THEN
        PERFORM log_order_activity(
            NEW.id,
            'engineer_assignment',
            CASE 
                WHEN NEW.engineer_id IS NULL THEN 'Engineer unassigned'
                ELSE 'Engineer assigned'
            END,
            jsonb_build_object(
                'old_engineer_id', OLD.engineer_id,
                'new_engineer_id', NEW.engineer_id
            )
        );
    END IF;
    
    -- Log install date booking
    IF TG_OP = 'UPDATE' AND OLD.scheduled_install_date IS DISTINCT FROM NEW.scheduled_install_date THEN
        PERFORM log_order_activity(
            NEW.id,
            'install_booking',
            CASE 
                WHEN NEW.scheduled_install_date IS NULL THEN 'Install date removed'
                ELSE 'Install date scheduled for ' || NEW.scheduled_install_date::DATE
            END,
            jsonb_build_object(
                'old_date', OLD.scheduled_install_date,
                'new_date', NEW.scheduled_install_date,
                'time_window', NEW.time_window
            )
        );
    END IF;
    
    -- Log agreement signing
    IF TG_OP = 'UPDATE' AND OLD.agreement_signed_at IS DISTINCT FROM NEW.agreement_signed_at THEN
        PERFORM log_order_activity(
            NEW.id,
            'agreement_signed',
            'Agreement signed',
            jsonb_build_object(
                'signed_at', NEW.agreement_signed_at
            )
        );
    END IF;
    
    -- Log payment updates
    IF TG_OP = 'UPDATE' AND OLD.amount_paid IS DISTINCT FROM NEW.amount_paid THEN
        PERFORM log_order_activity(
            NEW.id,
            'payment_update',
            'Payment recorded: £' || (NEW.amount_paid - OLD.amount_paid),
            jsonb_build_object(
                'old_amount', OLD.amount_paid,
                'new_amount', NEW.amount_paid,
                'payment_amount', NEW.amount_paid - OLD.amount_paid
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;