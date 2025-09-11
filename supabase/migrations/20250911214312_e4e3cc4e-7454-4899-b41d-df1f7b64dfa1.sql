-- Add 'job_site' as a valid location type for job-specific charger assignments
ALTER TABLE public.inventory_locations 
DROP CONSTRAINT IF EXISTS inventory_locations_type_check;

ALTER TABLE public.inventory_locations 
ADD CONSTRAINT inventory_locations_type_check 
CHECK (type IN ('warehouse', 'van', 'job_site'));