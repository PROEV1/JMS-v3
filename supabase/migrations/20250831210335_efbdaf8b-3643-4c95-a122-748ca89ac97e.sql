-- Step 1: Add email_normalized column first (this will help with deduplication)
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS email_normalized text GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED;

-- Step 2: Create a temporary table to identify duplicates
CREATE TEMP TABLE duplicate_analysis AS
WITH email_groups AS (
  SELECT 
    email_normalized,
    array_agg(id ORDER BY created_at ASC) as client_ids,
    count(*) as duplicate_count
  FROM clients 
  WHERE email_normalized IS NOT NULL
  GROUP BY email_normalized
  HAVING count(*) > 1
)
SELECT 
  email_normalized,
  client_ids[1] as keep_id,
  client_ids[2:] as delete_ids,
  duplicate_count
FROM email_groups;

-- Step 3: Update related records to point to the kept client
UPDATE orders 
SET client_id = da.keep_id
FROM duplicate_analysis da
WHERE orders.client_id = ANY(da.delete_ids);

UPDATE quotes 
SET client_id = da.keep_id
FROM duplicate_analysis da
WHERE quotes.client_id = ANY(da.delete_ids);

UPDATE files 
SET client_id = da.keep_id
FROM duplicate_analysis da
WHERE files.client_id = ANY(da.delete_ids);

UPDATE lead_history 
SET client_id = da.keep_id
FROM duplicate_analysis da
WHERE lead_history.client_id = ANY(da.delete_ids);

UPDATE leads 
SET client_id = da.keep_id
FROM duplicate_analysis da
WHERE leads.client_id = ANY(da.delete_ids);

UPDATE client_blocked_dates 
SET client_id = da.keep_id
FROM duplicate_analysis da
WHERE client_blocked_dates.client_id = ANY(da.delete_ids);

UPDATE client_surveys 
SET client_id = da.keep_id
FROM duplicate_analysis da
WHERE client_surveys.client_id = ANY(da.delete_ids);

UPDATE messages 
SET client_id = da.keep_id
FROM duplicate_analysis da
WHERE messages.client_id = ANY(da.delete_ids);

-- Step 4: Delete duplicate clients
DELETE FROM clients 
WHERE id IN (
  SELECT UNNEST(delete_ids) 
  FROM duplicate_analysis
);

-- Step 5: Create unique constraint on email_normalized
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email_normalized_unique 
ON clients (email_normalized);

-- Step 6: Add search indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_clients_full_name_trgm 
ON clients USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_email_trgm 
ON clients USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm 
ON clients USING gin (phone gin_trgm_ops) WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_address_trgm 
ON clients USING gin (address gin_trgm_ops) WHERE address IS NOT NULL;