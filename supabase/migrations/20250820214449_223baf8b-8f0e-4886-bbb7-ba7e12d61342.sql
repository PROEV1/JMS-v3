
-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'stock_request_status') then
    create type public.stock_request_status as enum (
      'submitted','approved','rejected','in_pick','in_transit','delivered','cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'stock_request_priority') then
    create type public.stock_request_priority as enum ('low','medium','high');
  end if;
end$$;

-- Parent table
create table if not exists public.stock_requests (
  id uuid primary key default gen_random_uuid(),
  engineer_id uuid not null references public.engineers(id) on delete restrict,
  requested_by uuid not null default auth.uid(),
  destination_location_id uuid not null references public.inventory_locations(id) on delete restrict,
  order_id uuid null references public.orders(id) on delete set null,
  needed_by date null,
  priority public.stock_request_priority not null default 'medium',
  status public.stock_request_status not null default 'submitted',
  notes text null,
  photo_url text null,
  idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_stock_requests_idem unique (engineer_id, idempotency_key)
);

-- Lines
create table if not exists public.stock_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.stock_requests(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  qty integer not null check (qty > 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Triggers for updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_timestamp_stock_requests') then
    create trigger set_timestamp_stock_requests
    before update on public.stock_requests
    for each row execute function public.update_updated_at_column();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'set_timestamp_stock_request_lines') then
    create trigger set_timestamp_stock_request_lines
    before update on public.stock_request_lines
    for each row execute function public.update_updated_at_column();
  end if;
end$$;

-- Helpful indexes
create index if not exists idx_stock_requests_engineer on public.stock_requests(engineer_id);
create index if not exists idx_stock_requests_status on public.stock_requests(status);
create index if not exists idx_stock_requests_needed_by on public.stock_requests(needed_by);
create index if not exists idx_stock_request_lines_request on public.stock_request_lines(request_id);
create index if not exists idx_stock_request_lines_item on public.stock_request_lines(item_id);

-- RLS
alter table public.stock_requests enable row level security;
alter table public.stock_request_lines enable row level security;

-- Admins manage everything
create policy if not exists "Admins manage stock_requests"
  on public.stock_requests
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy if not exists "Admins manage stock_request_lines"
  on public.stock_request_lines
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Managers can view all
create policy if not exists "Managers can view stock_requests"
  on public.stock_requests
  for select
  to authenticated
  using (public.is_admin() or public.is_manager());

create policy if not exists "Managers can view stock_request_lines"
  on public.stock_request_lines
  for select
  to authenticated
  using (public.is_admin() or public.is_manager());

-- Engineers: create/select/update own requests (while submitted or cancelling)
create policy if not exists "Engineers insert their own stock_requests"
  on public.stock_requests
  for insert
  to authenticated
  with check (
    engineer_id in (select e.id from public.engineers e where e.user_id = auth.uid())
  );

create policy if not exists "Engineers view their own stock_requests"
  on public.stock_requests
  for select
  to authenticated
  using (
    engineer_id in (select e.id from public.engineers e where e.user_id = auth.uid())
  );

create policy if not exists "Engineers update their submitted/cancel stock_requests"
  on public.stock_requests
  for update
  to authenticated
  using (
    engineer_id in (select e.id from public.engineers e where e.user_id = auth.uid())
    and status in ('submitted')
  )
  with check (
    engineer_id in (select e.id from public.engineers e where e.user_id = auth.uid())
    and status in ('submitted','cancelled')
  );

-- Lines follow parent access; engineers can manage lines while request is submitted
create policy if not exists "Engineers manage lines for their submitted requests"
  on public.stock_request_lines
  for all
  to authenticated
  using (
    exists (
      select 1 from public.stock_requests r
      join public.engineers e on e.id = r.engineer_id
      where r.id = stock_request_lines.request_id
        and e.user_id = auth.uid()
        and r.status = 'submitted'
    )
  )
  with check (
    exists (
      select 1 from public.stock_requests r
      join public.engineers e on e.id = r.engineer_id
      where r.id = stock_request_lines.request_id
        and e.user_id = auth.uid()
        and r.status = 'submitted'
    )
  );

-- Public bucket for attachments (simple start)
insert into storage.buckets (id, name, public)
values ('stock-request-attachments','stock-request-attachments', true)
on conflict (id) do nothing;

-- Allow public read to attachments bucket
create policy if not exists "Public read stock request attachments"
  on storage.objects for select
  using (bucket_id = 'stock-request-attachments');

-- Allow authenticated to upload to attachments bucket
create policy if not exists "Authenticated upload stock request attachments"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'stock-request-attachments');

-- Allow admins to delete attachments
create policy if not exists "Admins delete stock request attachments"
  on storage.objects for delete to authenticated
  using (bucket_id = 'stock-request-attachments' and public.is_admin());
