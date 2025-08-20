
-- 1) Mark charger items
alter table public.inventory_items
  add column if not exists is_charger boolean not null default false;

-- 2) Associate locations to engineers (for van locations)
alter table public.inventory_locations
  add column if not exists engineer_id uuid null;

alter table public.inventory_locations
  add constraint if not exists inventory_locations_engineer_id_fkey
  foreign key (engineer_id) references public.engineers(id) on delete set null;

-- Enforce one van per engineer (only when type='van' and engineer_id is set)
create unique index if not exists ux_inventory_locations_engineer_van
  on public.inventory_locations (engineer_id)
  where (type = 'van' and engineer_id is not null);

-- 3) Link inventory transactions to orders (so movements can be tied to a job)
alter table public.inventory_txns
  add column if not exists order_id uuid null;

alter table public.inventory_txns
  add constraint if not exists inventory_txns_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete set null;

-- 4) Enums for dispatches
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dispatch_status') then
    create type public.dispatch_status as enum ('not_required','not_sent','pending_dispatch','sent','delivered','returned','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'dispatch_method') then
    create type public.dispatch_method as enum ('to_van','direct_to_consumer');
  end if;
end$$;

-- 5) Charger dispatches table
create table if not exists public.charger_dispatches (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  qty integer not null default 1 check (qty > 0),
  method public.dispatch_method not null default 'direct_to_consumer',
  status public.dispatch_status not null default 'not_sent',
  tracking_number text,
  fulfilment_partner text,
  external_id text,
  from_location_id uuid references public.inventory_locations(id),
  to_location_id uuid references public.inventory_locations(id),
  engineer_id uuid references public.engineers(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);

-- 5a) RLS for charger_dispatches
alter table public.charger_dispatches enable row level security;

-- Admins manage everything
create policy if not exists "Admins manage charger dispatches"
  on public.charger_dispatches
  for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Managers can view
create policy if not exists "Managers can view dispatches"
  on public.charger_dispatches
  for select
  to authenticated
  using (is_admin() or is_manager());

-- Users (e.g. engineers/clients) can view if they can view the order
create policy if not exists "Users can view dispatches for accessible orders"
  on public.charger_dispatches
  for select
  to authenticated
  using (public.user_can_view_order(order_id));

-- 5b) Keep updated_at fresh
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_timestamp_charger_dispatches'
  ) then
    create trigger set_timestamp_charger_dispatches
    before update on public.charger_dispatches
    for each row
    execute function public.update_updated_at_column();
  end if;
end$$;

-- Helpful indexes
create index if not exists idx_charger_dispatches_order_id on public.charger_dispatches(order_id);
create index if not exists idx_charger_dispatches_status on public.charger_dispatches(status);
create index if not exists idx_charger_dispatches_engineer_id on public.charger_dispatches(engineer_id);
