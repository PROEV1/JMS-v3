-- Clean up existing orders by extracting postcodes from job_address
UPDATE orders 
SET postcode = CASE 
  -- Extract UK postcode pattern from job_address using regex
  WHEN job_address ~ '[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}' THEN 
    (regexp_match(job_address, '([A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2})'))[1]
  ELSE postcode
END
WHERE job_address IS NOT NULL 
AND (postcode IS NULL OR postcode = 'W1 5EE' OR postcode = 'M1 1AA' OR postcode LIKE '%fake%');