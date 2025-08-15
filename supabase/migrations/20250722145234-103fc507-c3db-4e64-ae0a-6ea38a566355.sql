-- Fix the RLS policy to avoid infinite recursion by using a simpler approach
DROP POLICY IF EXISTS "Users can view messages for their projects/quotes" ON public.messages;

CREATE POLICY "Users can view messages for their projects/quotes" 
ON public.messages 
FOR SELECT 
USING (
  -- Admins can see all messages
  (get_user_role(auth.uid()) = 'admin'::user_role) OR
  -- Clients can see messages for their projects
  (project_id IN ( 
    SELECT projects.id
    FROM projects
    WHERE (projects.client_id IN ( 
      SELECT clients.id
      FROM clients
      WHERE (clients.user_id = auth.uid())
    ))
  )) OR 
  -- Clients can see messages for their quotes
  (quote_id IN ( 
    SELECT quotes.id
    FROM quotes
    WHERE (quotes.client_id IN ( 
      SELECT clients.id
      FROM clients
      WHERE (clients.user_id = auth.uid())
    ))
  )) OR
  -- Clients can see general conversation messages (no specific project/quote)
  -- either messages they sent, or admin messages in general conversation
  (quote_id IS NULL AND project_id IS NULL AND (
    sender_id = auth.uid() OR sender_role = 'admin'
  ))
);