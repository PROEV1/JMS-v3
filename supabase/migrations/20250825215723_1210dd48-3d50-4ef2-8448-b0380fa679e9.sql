-- Add revision_reason to order_quote_snapshots for tracking changes
ALTER TABLE order_quote_snapshots ADD COLUMN IF NOT EXISTS revision_reason text;

-- Add index for better performance on quote lookups
CREATE INDEX IF NOT EXISTS idx_order_quote_snapshots_order_created 
ON order_quote_snapshots(order_id, created_at DESC);

-- Update trigger to recalculate order status when surveys change
CREATE OR REPLACE FUNCTION update_order_status_on_survey_change()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id uuid;
  order_record public.orders%ROWTYPE;
BEGIN
  -- Get the order ID from the survey record
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  
  IF v_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get the order record
  SELECT * INTO order_record FROM public.orders WHERE id = v_order_id;
  
  IF FOUND THEN
    -- Update the order status using the enhanced calculation function
    UPDATE public.orders
    SET status_enhanced = public.calculate_order_status_final(order_record),
        updated_at = now()
    WHERE id = v_order_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for survey status changes
DROP TRIGGER IF EXISTS trg_update_order_on_survey_change ON client_surveys;
CREATE TRIGGER trg_update_order_on_survey_change
  AFTER INSERT OR UPDATE OR DELETE ON client_surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_survey_change();

-- Update trigger to recalculate order status when quotes change  
CREATE OR REPLACE FUNCTION update_order_status_on_quote_change()
RETURNS TRIGGER AS $$
DECLARE
  order_record public.orders%ROWTYPE;
BEGIN
  -- Only process if quote status changed to 'sent' or order_id changed
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status AND OLD.order_id = NEW.order_id THEN
    RETURN NEW;
  END IF;

  -- Get the order record if quote is linked to an order
  IF NEW.order_id IS NOT NULL THEN
    SELECT * INTO order_record FROM public.orders WHERE id = NEW.order_id;
    
    IF FOUND THEN
      -- If quote status changed to 'sent', update order to needs_quote_acceptance
      IF NEW.status = 'sent' THEN
        UPDATE public.orders
        SET status_enhanced = 'needs_quote_acceptance'::order_status_enhanced,
            updated_at = now()
        WHERE id = NEW.order_id;
      ELSE
        -- Recalculate based on current order state
        UPDATE public.orders
        SET status_enhanced = public.calculate_order_status_final(order_record),
            updated_at = now()
        WHERE id = NEW.order_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for quote status changes
DROP TRIGGER IF EXISTS trg_update_order_on_quote_change ON quotes;
CREATE TRIGGER trg_update_order_on_quote_change
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_on_quote_change();