-- Create a function to update engineer stock when request is delivered
CREATE OR REPLACE FUNCTION public.update_engineer_stock_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    
    -- Insert inventory transactions for each item in the request
    INSERT INTO public.inventory_txns (
      item_id,
      location_id,
      direction,
      qty,
      reference,
      notes,
      created_by
    )
    SELECT 
      srl.item_id,
      NEW.destination_location_id,
      'in',
      srl.qty,
      'Stock request delivery: ' || NEW.id,
      'Delivered from stock request #' || NEW.id || 
      CASE WHEN NEW.order_id IS NOT NULL THEN ' for order ' || (SELECT order_number FROM orders WHERE id = NEW.order_id) ELSE '' END,
      auth.uid()
    FROM public.stock_request_lines srl
    WHERE srl.request_id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on stock_requests table
DROP TRIGGER IF EXISTS trigger_update_engineer_stock_on_delivery ON public.stock_requests;
CREATE TRIGGER trigger_update_engineer_stock_on_delivery
  AFTER UPDATE ON public.stock_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_engineer_stock_on_delivery();