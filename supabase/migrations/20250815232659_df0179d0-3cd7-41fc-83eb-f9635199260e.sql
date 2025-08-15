
-- 1) Add client_id to messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(client_id);

-- 2) Backfill client_id for existing messages where possible
UPDATE public.messages m
SET client_id = q.client_id
FROM public.quotes q
WHERE m.client_id IS NULL
  AND m.quote_id = q.id;

UPDATE public.messages m
SET client_id = p.client_id
FROM public.projects p
WHERE m.client_id IS NULL
  AND m.project_id = p.id;

-- 3) Update RLS policies to include client_id access

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view messages for their projects/quotes" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages for their projects/quotes" ON public.messages;

-- Recreate SELECT policy including client_id
CREATE POLICY "Users can view messages (client, quote, project, or admin)"
ON public.messages
FOR SELECT
USING (
  -- Admins can view everything
  (get_user_role(auth.uid()) = 'admin'::user_role)
  OR
  -- Client can view messages tied directly to their client record
  (client_id IN (
    SELECT c.id
    FROM public.clients c
    WHERE c.user_id = auth.uid()
  ))
  OR
  -- Client can view messages via quotes they own
  (quote_id IN (
    SELECT q.id
    FROM public.quotes q
    JOIN public.clients c ON c.id = q.client_id
    WHERE c.user_id = auth.uid()
  ))
  OR
  -- Client can view messages via projects they own
  (project_id IN (
    SELECT p.id
    FROM public.projects p
    JOIN public.clients c ON c.id = p.client_id
    WHERE c.user_id = auth.uid()
  ))
);

-- Recreate INSERT policy including client_id
CREATE POLICY "Users can send messages (client, quote, project, or admin)"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND (
    -- Admin can insert anywhere
    (get_user_role(auth.uid()) = 'admin'::user_role)
    OR
    -- Client can insert when tied to their client record
    (client_id IN (
      SELECT c.id
      FROM public.clients c
      WHERE c.user_id = auth.uid()
    ))
    OR
    -- Client can insert when tied to their quote
    (quote_id IN (
      SELECT q.id
      FROM public.quotes q
      JOIN public.clients c ON c.id = q.client_id
      WHERE c.user_id = auth.uid()
    ))
    OR
    -- Client can insert when tied to their project
    (project_id IN (
      SELECT p.id
      FROM public.projects p
      JOIN public.clients c ON c.id = p.client_id
      WHERE c.user_id = auth.uid()
    ))
  )
);
