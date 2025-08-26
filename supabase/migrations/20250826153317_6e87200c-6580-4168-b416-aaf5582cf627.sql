-- Create trigger to update order status when job_offers change
CREATE OR REPLACE FUNCTION public.update_order_status_on_offer_change()
RETURNS TRIGGER AS $$
DECLARE
  order_record orders;
BEGIN
  SELECT * INTO order_record FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  IF FOUND THEN
    UPDATE orders 
    SET status_enhanced = public.calculate_order_status_final(order_record),
        updated_at = NOW()
    WHERE id = order_record.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers on job_offers table
DROP TRIGGER IF EXISTS trg_update_order_status_on_offer_insert ON job_offers;
DROP TRIGGER IF EXISTS trg_update_order_status_on_offer_update ON job_offers;
DROP TRIGGER IF EXISTS trg_update_order_status_on_offer_delete ON job_offers;

CREATE TRIGGER trg_update_order_status_on_offer_insert
  AFTER INSERT ON job_offers
  FOR EACH ROW EXECUTE FUNCTION update_order_status_on_offer_change();

CREATE TRIGGER trg_update_order_status_on_offer_update
  AFTER UPDATE ON job_offers
  FOR EACH ROW EXECUTE FUNCTION update_order_status_on_offer_change();

CREATE TRIGGER trg_update_order_status_on_offer_delete
  AFTER DELETE ON job_offers
  FOR EACH ROW EXECUTE FUNCTION update_order_status_on_offer_change();