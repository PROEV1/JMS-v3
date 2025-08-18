-- Add foreign key constraints for proper cleanup
ALTER TABLE job_offers 
ADD CONSTRAINT fk_job_offers_order_id 
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE job_offers 
ADD CONSTRAINT fk_job_offers_engineer_id 
FOREIGN KEY (engineer_id) REFERENCES engineers(id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_offers_order_id ON job_offers(order_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_engineer_id ON job_offers(engineer_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_status_expires ON job_offers(status, expires_at);

-- Create trigger to auto-expire offers when orders are unassigned or reset
CREATE OR REPLACE FUNCTION expire_offers_on_order_reset()
RETURNS TRIGGER AS $$
BEGIN
  -- If engineer_id is being set to null or scheduled_install_date is being cleared
  IF (OLD.engineer_id IS NOT NULL AND NEW.engineer_id IS NULL) OR
     (OLD.scheduled_install_date IS NOT NULL AND NEW.scheduled_install_date IS NULL) OR
     (NEW.status_enhanced = 'awaiting_install_booking' AND OLD.status_enhanced != 'awaiting_install_booking') THEN
    
    -- Expire any pending offers for this order
    UPDATE job_offers 
    SET 
      status = 'expired',
      expired_at = now(),
      updated_at = now(),
      delivery_details = COALESCE(delivery_details, '{}')::jsonb || 
        jsonb_build_object(
          'auto_expired_reason', 'order_reset',
          'auto_expired_at', now()
        )
    WHERE order_id = NEW.id 
      AND status = 'pending'
      AND expires_at > now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the orders table
DROP TRIGGER IF EXISTS trigger_expire_offers_on_order_reset ON orders;
CREATE TRIGGER trigger_expire_offers_on_order_reset
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION expire_offers_on_order_reset();