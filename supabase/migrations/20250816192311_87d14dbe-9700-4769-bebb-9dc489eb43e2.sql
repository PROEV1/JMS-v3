-- Add unique constraints for idempotent CSV imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_availability_unique 
ON engineer_availability(engineer_id, day_of_week);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_service_areas_unique 
ON engineer_service_areas(engineer_id, postcode_area);