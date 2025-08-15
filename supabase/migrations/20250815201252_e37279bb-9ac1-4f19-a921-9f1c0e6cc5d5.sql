
-- 1) Add client_id to messages and index it
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

CREATE INDEX IF NOT EXISTS messages_client_id_idx ON public.messages(client_id);

-- 2) Backfill client_id from quotes and projects where possible
UPDATE public.messages m
SET client_id = q.client_id
FROM public.quotes q
WHERE m.quote_id = q.id
  AND m.client_id IS NULL;

UPDATE public.messages m
SET client_id = p.client_id
FROM public.projects p
WHERE m.project_id = p.id
  AND m.client_id IS NULL;

-- 3) Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4) Allow viewing client-thread messages
CREATE POLICY IF NOT EXISTS "Users can view client thread messages"
  ON public.messages
  FOR SELECT
  USING (
    (client_id IN (SELECT clients.id FROM public.clients WHERE clients.user_id = auth.uid()))
    OR (get_user_role(auth.uid()) = 'admin'::user_role)
  );

-- 5) Allow sending client-thread messages (insert)
CREATE POLICY IF NOT EXISTS "Users can send client thread messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    (sender_id = auth.uid()) AND (
      (client_id IN (SELECT clients.id FROM public.clients WHERE clients.user_id = auth.uid()))
      OR (get_user_role(auth.uid()) = 'admin'::user_role)
    )
  );

-- 6) Allow updating client-thread messages (e.g., mark as read)
CREATE POLICY IF NOT EXISTS "Users can update client thread messages"
  ON public.messages
  FOR UPDATE
  USING (
    (client_id IN (SELECT clients.id FROM public.clients WHERE clients.user_id = auth.uid()))
    OR (get_user_role(auth.uid()) = 'admin'::user_role)
  );
