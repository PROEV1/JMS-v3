-- First, let's check for messages without client_id and try to backfill them
-- Update messages where client_id is null by looking up the client from the sender_id
UPDATE messages 
SET client_id = (
  SELECT c.id 
  FROM clients c 
  WHERE c.user_id = messages.sender_id
)
WHERE client_id IS NULL 
AND sender_role = 'client'
AND EXISTS (
  SELECT 1 FROM clients c WHERE c.user_id = messages.sender_id
);

-- For admin messages without client_id, we can't easily backfill them
-- but we'll handle this in the application logic