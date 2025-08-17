
-- 1) Engineers can view orders assigned to them
create policy "Engineers can view assigned orders"
on public.orders
for select
using (
  exists (
    select 1
    from engineers e
    where e.id = orders.engineer_id
      and e.user_id = auth.uid()
  )
);

-- 2) Engineers can update their assigned orders (for sign-off/notes/status)
create policy "Engineers can update assigned orders"
on public.orders
for update
using (
  exists (
    select 1
    from engineers e
    where e.id = orders.engineer_id
      and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from engineers e
    where e.id = orders.engineer_id
      and e.user_id = auth.uid()
  )
);

-- 3) Engineers can view client info for their assigned orders
create policy "Engineers can view clients for assigned orders"
on public.clients
for select
using (
  exists (
    select 1
    from orders o
    join engineers e on e.id = o.engineer_id
    where o.client_id = clients.id
      and e.user_id = auth.uid()
  )
);

-- 4) Engineers can view quotes for their assigned orders
create policy "Engineers can view quotes for assigned orders"
on public.quotes
for select
using (
  exists (
    select 1
    from orders o
    join engineers e on e.id = o.engineer_id
    where o.quote_id = quotes.id
      and e.user_id = auth.uid()
  )
);
