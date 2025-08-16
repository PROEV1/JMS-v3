
-- Allow clients to create orders for their own quotes
DROP POLICY IF EXISTS "Clients can create their own orders" ON public.orders;

CREATE POLICY "Clients can create their own orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (
    -- Ensure the new order is for the logged-in client's own record
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_id
        AND c.user_id = auth.uid()
    )
    AND
    -- Ensure the quote being linked also belongs to the same client
    EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = quote_id
        AND q.client_id = client_id
    )
  );
