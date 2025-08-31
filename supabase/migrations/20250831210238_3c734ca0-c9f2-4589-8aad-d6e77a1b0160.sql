-- Step 1: Clean up duplicate clients by merging them
-- Find and merge duplicate clients based on email
WITH duplicate_clients AS (
  SELECT 
    email,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY created_at) as all_ids,
    COUNT(*) as duplicate_count
  FROM clients 
  GROUP BY LOWER(TRIM(email))
  HAVING COUNT(*) > 1
),
clients_to_delete AS (
  SELECT 
    UNNEST(all_ids[2:]) as id_to_delete,
    keep_id
  FROM duplicate_clients
)
-- Update orders to point to the kept client
UPDATE orders 
SET client_id = ctd.keep_id
FROM clients_to_delete ctd
WHERE orders.client_id = ctd.id_to_delete;

-- Update other related tables
UPDATE quotes 
SET client_id = ctd.keep_id
FROM clients_to_delete ctd
WHERE quotes.client_id = ctd.id_to_delete;

UPDATE files 
SET client_id = ctd.keep_id
FROM clients_to_delete ctd
WHERE files.client_id = ctd.id_to_delete;

UPDATE lead_history 
SET client_id = ctd.keep_id
FROM clients_to_delete ctd
WHERE lead_history.client_id = ctd.id_to_delete;

UPDATE leads 
SET client_id = ctd.keep_id
FROM clients_to_delete ctd
WHERE leads.client_id = ctd.id_to_delete;

UPDATE client_blocked_dates 
SET client_id = ctd.keep_id
FROM clients_to_delete ctd
WHERE client_blocked_dates.client_id = ctd.id_to_delete;

UPDATE client_surveys 
SET client_id = ctd.keep_id
FROM clients_to_delete ctd
WHERE client_surveys.client_id = ctd.id_to_delete;

UPDATE messages 
SET client_id = ctd.keep_id
FROM clients_to_delete ctd
WHERE messages.client_id = ctd.id_to_delete;

-- Delete duplicate client records
WITH clients_to_delete AS (
  WITH duplicate_clients AS (
    SELECT 
      email,
      MIN(id) as keep_id,
      ARRAY_AGG(id ORDER BY created_at) as all_ids
    FROM clients 
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
  )
  SELECT UNNEST(all_ids[2:]) as id_to_delete
  FROM duplicate_clients
)
DELETE FROM clients 
WHERE id IN (SELECT id_to_delete FROM clients_to_delete);

-- Step 2: Add email_normalized generated column and unique constraint
ALTER TABLE clients 
ADD COLUMN email_normalized text GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED;

-- Create unique index on normalized email
CREATE UNIQUE INDEX idx_clients_email_normalized_unique 
ON clients (email_normalized);

-- Step 3: Add helpful indexes for search
CREATE INDEX IF NOT EXISTS idx_clients_full_name_trgm 
ON clients USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_search_composite 
ON clients (full_name, email, phone, address);