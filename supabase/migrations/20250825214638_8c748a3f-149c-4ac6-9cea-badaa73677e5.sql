-- Add trigger to update order status when survey changes
CREATE OR REPLACE FUNCTION public.update_order_status_on_survey_change()
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