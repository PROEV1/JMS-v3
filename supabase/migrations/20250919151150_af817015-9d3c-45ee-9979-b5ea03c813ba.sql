-- Clean up duplicate foreign key relationships in job_offers table
-- Remove the older constraint to keep only the newer one

-- Check which constraint is older and remove it
-- This will fix the "more than one relationship" error in Supabase queries
ALTER TABLE public.job_offers DROP CONSTRAINT IF EXISTS job_offers_engineer_id_fkey;