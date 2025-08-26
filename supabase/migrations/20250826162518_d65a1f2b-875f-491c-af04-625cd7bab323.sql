-- Add trigger to recalculate status_enhanced when payment amounts change
CREATE OR REPLACE FUNCTION public.update_order_status_on_payment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if amount_paid changed
  IF TG_OP = 'UPDATE' AND (OLD.amount_paid IS DISTINCT FROM NEW.amount_paid) THEN
    -- Recalculate status_enhanced using the existing function
    NEW.status_enhanced := public.calculate_order_status_final(NEW);
    NEW.updated_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for orders table
DROP TRIGGER IF EXISTS trg_update_status_on_payment ON public.orders;
CREATE TRIGGER trg_update_status_on_payment
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_status_on_payment_change();