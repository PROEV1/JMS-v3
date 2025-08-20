-- Add unbounded column to engineer_service_areas table
ALTER TABLE public.engineer_service_areas 
ADD COLUMN unbounded boolean NOT NULL DEFAULT false;

-- Add index for efficient filtering
CREATE INDEX idx_engineer_service_areas_unbounded 
ON public.engineer_service_areas(engineer_id, unbounded);

-- Add comment for clarity
COMMENT ON COLUMN public.engineer_service_areas.unbounded IS 'When true, engineer can serve this postcode area regardless of travel time limits';