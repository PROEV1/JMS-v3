-- Add client_survey_required field to partners table
ALTER TABLE public.partners 
ADD COLUMN client_survey_required boolean DEFAULT true;

-- Update existing partners to have survey required by default
UPDATE public.partners 
SET client_survey_required = true 
WHERE client_survey_required IS NULL;