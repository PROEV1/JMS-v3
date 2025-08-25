-- Create trigger function to expire pending offers when order gets scheduled
CREATE OR REPLACE FUNCTION expire_pending_offers_on_schedule()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if order is being scheduled (scheduled_install_date set from NULL or status_enhanced becomes 'scheduled')
  IF TG_OP = 'UPDATE' THEN
    -- If scheduled_install_date changed from NULL to NOT NULL, or status_enhanced became 'scheduled', or partner status indicates confirmed
    IF (
      (OLD.scheduled_install_date IS NULL AND NEW.scheduled_install_date IS NOT NULL) OR
      (NEW.status_enhanced = 'scheduled' AND OLD.status_enhanced != 'scheduled') OR
      (NEW.partner_status = 'INSTALL_DATE_CONFIRMED' AND OLD.partner_status != 'INSTALL_DATE_CONFIRMED')
    ) THEN
      -- Expire any pending offers for this order
      UPDATE job_offers 
      SET 
        status = 'expired',
        expired_at = now(),
        updated_at = now(),
        delivery_details = COALESCE(delivery_details, '{}')::jsonb || 
          jsonb_build_object(
            'auto_expired_due_to_schedule', true,
            'auto_expired_at', now(),
            'reason', 'order_scheduled'
          )
      WHERE order_id = NEW.id 
        AND status = 'pending'
        AND expires_at > now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-expire offers when orders get scheduled
DROP TRIGGER IF EXISTS expire_offers_on_schedule ON orders;
CREATE TRIGGER expire_offers_on_schedule
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION expire_pending_offers_on_schedule();