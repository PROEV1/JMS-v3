-- Add sample postcodes to existing orders for testing Mapbox integration
UPDATE orders 
SET job_address = CASE 
  WHEN job_address IS NULL OR job_address = '' THEN 
    CASE 
      WHEN EXTRACT(epoch FROM created_at)::integer % 5 = 0 THEN '123 High Street, Manchester M1 1AA'
      WHEN EXTRACT(epoch FROM created_at)::integer % 5 = 1 THEN '456 Queen Street, Birmingham B1 2BB' 
      WHEN EXTRACT(epoch FROM created_at)::integer % 5 = 2 THEN '789 King Road, Liverpool L1 3CC'
      WHEN EXTRACT(epoch FROM created_at)::integer % 5 = 3 THEN '321 Park Lane, Leeds LS1 4DD'
      ELSE '654 Victoria Street, London W1 5EE'
    END
  ELSE job_address
END,
postcode = CASE 
  WHEN postcode IS NULL OR postcode = '' THEN 
    CASE 
      WHEN EXTRACT(epoch FROM created_at)::integer % 5 = 0 THEN 'M1 1AA'
      WHEN EXTRACT(epoch FROM created_at)::integer % 5 = 1 THEN 'B1 2BB'
      WHEN EXTRACT(epoch FROM created_at)::integer % 5 = 2 THEN 'L1 3CC'
      WHEN EXTRACT(epoch FROM created_at)::integer % 5 = 3 THEN 'LS1 4DD'
      ELSE 'W1 5EE'
    END
  ELSE postcode
END
WHERE job_address IS NULL OR job_address = '' OR postcode IS NULL OR postcode = '';

-- Add sample starting postcodes to engineers for testing
UPDATE engineers 
SET starting_postcode = CASE 
  WHEN starting_postcode IS NULL OR starting_postcode = '' THEN 
    CASE 
      WHEN EXTRACT(epoch FROM created_at)::integer % 4 = 0 THEN 'M2 2FF'
      WHEN EXTRACT(epoch FROM created_at)::integer % 4 = 1 THEN 'B2 3GG'
      WHEN EXTRACT(epoch FROM created_at)::integer % 4 = 2 THEN 'L2 4HH'
      ELSE 'LS2 5II'
    END
  ELSE starting_postcode
END
WHERE starting_postcode IS NULL OR starting_postcode = '';