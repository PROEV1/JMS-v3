
-- 1) Allow fractional hours like 0.5 (30 minutes) on order duration
ALTER TABLE public.orders
  ALTER COLUMN estimated_duration_hours TYPE numeric(4,2)
  USING estimated_duration_hours::numeric;

COMMENT ON COLUMN public.orders.estimated_duration_hours IS 'Estimated job duration in hours. Supports fractional values (e.g., 0.5 for 30 minutes).';

-- 2) Add configurable job-type defaults to import profiles
ALTER TABLE public.partner_import_profiles
  ADD COLUMN IF NOT EXISTS job_duration_defaults jsonb NOT NULL
  DEFAULT '{"installation": 3, "assessment": 0.5, "service_call": 1}'::jsonb;

COMMENT ON COLUMN public.partner_import_profiles.job_duration_defaults IS 'Default duration per job type (in hours). Example: {"installation":3,"assessment":0.5,"service_call":1}';
