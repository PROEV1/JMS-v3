
-- Ensure a unique pair so we can upsert service areas reliably
CREATE UNIQUE INDEX IF NOT EXISTS uniq_engineer_service_area
  ON public.engineer_service_areas (engineer_id, postcode_area);
