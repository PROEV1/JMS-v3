-- Create trigger to ensure survey_required is properly set based on partner settings
-- This prevents future data drift between order.survey_required and partner.client_survey_required

CREATE OR REPLACE FUNCTION sync_order_survey_requirement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process partner jobs
  IF NEW.is_partner_job = true AND NEW.partner_id IS NOT NULL THEN
    -- Get partner's survey requirement setting
    SELECT client_survey_required INTO NEW.survey_required
    FROM partners 
    WHERE id = NEW.partner_id;
    
    -- If partner setting is null, default to true
    NEW.survey_required := COALESCE(NEW.survey_required, true);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to run on INSERT and UPDATE
DROP TRIGGER IF EXISTS sync_order_survey_requirement_trigger ON orders;
CREATE TRIGGER sync_order_survey_requirement_trigger
  BEFORE INSERT OR UPDATE OF is_partner_job, partner_id
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_survey_requirement();