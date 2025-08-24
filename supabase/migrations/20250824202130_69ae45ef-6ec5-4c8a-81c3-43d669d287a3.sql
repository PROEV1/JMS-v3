-- Fix survey_required field for partner jobs where partner doesn't require surveys
-- This addresses the issue where orders show "Assessment" status when partner has client_survey_required = false

UPDATE orders 
SET survey_required = false
WHERE is_partner_job = true 
  AND partner_id IN (
    SELECT id FROM partners 
    WHERE client_survey_required = false
  )
  AND survey_required = true;