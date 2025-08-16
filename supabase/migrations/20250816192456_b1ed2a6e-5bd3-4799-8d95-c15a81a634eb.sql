-- Clean up duplicate entries before adding unique constraints
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY engineer_id, postcode_area ORDER BY created_at) as rn
  FROM engineer_service_areas
)
DELETE FROM engineer_service_areas 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Also clean up any entries with empty postcode_area
DELETE FROM engineer_service_areas WHERE postcode_area = '' OR postcode_area IS NULL;

-- Now add unique constraints for idempotent CSV imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_availability_unique 
ON engineer_availability(engineer_id, day_of_week);

CREATE UNIQUE INDEX IF NOT EXISTS idx_engineer_service_areas_unique 
ON engineer_service_areas(engineer_id, postcode_area);