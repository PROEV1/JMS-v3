-- Enhanced Order Status System with 11 statuses
DO $$ BEGIN
    CREATE TYPE order_status_enhanced AS ENUM (
        'quote_accepted',
        'awaiting_payment', 
        'payment_received',
        'awaiting_agreement',
        'agreement_signed',
        'awaiting_install_booking',
        'scheduled',
        'in_progress',
        'install_completed_pending_qa',
        'completed',
        'revisit_required'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create order activity log table
CREATE TABLE IF NOT EXISTS public.order_activity (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for order activity
ALTER TABLE public.order_activity ENABLE ROW LEVEL SECURITY;

-- Create policies for order activity
CREATE POLICY "Admins can manage all order activity" 
ON public.order_activity 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

CREATE POLICY "Clients can view activity for their orders" 
ON public.order_activity 
FOR SELECT 
USING (order_id IN (
    SELECT o.id FROM orders o 
    JOIN clients c ON o.client_id = c.id 
    WHERE c.user_id = auth.uid()
));

-- Add enhanced status field to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_enhanced order_status_enhanced DEFAULT 'quote_accepted';

-- Add manual status override fields
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS manual_status_override BOOLEAN DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS manual_status_notes TEXT;

-- Add install management fields
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS time_window TEXT; -- 'morning', 'afternoon', 'all_day'
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_duration_hours INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS internal_install_notes TEXT;

-- Function to calculate automatic order status
CREATE OR REPLACE FUNCTION calculate_order_status(order_row orders)
RETURNS order_status_enhanced
LANGUAGE plpgsql
STABLE
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

-- Function to log order activity
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

-- Trigger to update status automatically
CREATE OR REPLACE FUNCTION update_order_status_enhanced()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.status_enhanced := calculate_order_status(NEW);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_order_status_enhanced
    BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status_enhanced();

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
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

CREATE TRIGGER trigger_log_order_changes
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change();

-- Update existing orders to have enhanced status
UPDATE public.orders 
SET status_enhanced = 
    CASE 
        WHEN status = 'awaiting_payment' THEN 'awaiting_payment'::order_status_enhanced
        WHEN status = 'agreement_signed' THEN 'agreement_signed'::order_status_enhanced
        WHEN status = 'completed' THEN 'completed'::order_status_enhanced
        ELSE 'quote_accepted'::order_status_enhanced
    END
WHERE status_enhanced IS NULL;