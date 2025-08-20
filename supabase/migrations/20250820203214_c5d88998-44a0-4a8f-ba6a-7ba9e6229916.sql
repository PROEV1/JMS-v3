
-- 1) Suppliers
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Inventory Items
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name text not null,
  description text,
  is_serialized boolean not null default false,
  default_cost numeric not null default 0,
  unit text not null default 'each',
  min_level integer not null default 0,
  max_level integer not null default 0,
  reorder_point integer not null default 0,
  is_active boolean not null default true,
  supplier_id uuid references public.suppliers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_inventory_items_supplier_id on public.inventory_items(supplier_id);
create index if not exists idx_inventory_items_name on public.inventory_items(name);
create index if not exists idx_inventory_items_sku on public.inventory_items(sku);

-- 3) Inventory Locations
create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  type text default 'warehouse',
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_locations_name on public.inventory_locations(name);
create index if not exists idx_inventory_locations_code on public.inventory_locations(code);

-- 4) Inventory Transactions (stock movements)
create table if not exists public.inventory_txns (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  location_id uuid not null references public.inventory_locations(id) on delete cascade,
  -- positive qty adds stock, negative reduces (or keep direction field if desired)
  qty integer not null,
  direction text not null default 'in', -- 'in' | 'out' | 'adjust' (not enforced with CHECK to avoid future constraints issues)
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists idx_inventory_txns_item_id on public.inventory_txns(item_id);
create index if not exists idx_inventory_txns_location_id on public.inventory_txns(location_id);
create index if not exists idx_inventory_txns_created_at on public.inventory_txns(created_at);

-- 5) View: item/location balances
create or replace view public.vw_item_location_balances as
select
  t.item_id,
  t.location_id,
  coalesce(sum(
    case
      when t.direction = 'in' then t.qty
      when t.direction = 'adjust' then t.qty
      else -t.qty
    end
  ), 0)::int as on_hand
from public.inventory_txns t
group by t.item_id, t.location_id;

-- 6) Update updated_at triggers
drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_inventory_locations_updated_at on public.inventory_locations;
create trigger trg_inventory_locations_updated_at
before update on public.inventory_locations
for each row execute function public.update_updated_at_column();

-- 7) RLS and policies (admins manage; managers can view)
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_txns enable row level security;

-- Suppliers
drop policy if exists "Admins manage suppliers" on public.suppliers;
create policy "Admins manage suppliers"
on public.suppliers for all
using (is_admin()) with check (is_admin());

drop policy if exists "Managers can view suppliers" on public.suppliers;
create policy "Managers can view suppliers"
on public.suppliers for select
using (is_admin() or is_manager());

-- Items
drop policy if exists "Admins manage items" on public.inventory_items;
create policy "Admins manage items"
on public.inventory_items for all
using (is_admin()) with check (is_admin());

drop policy if exists "Managers can view items" on public.inventory_items;
create policy "Managers can view items"
on public.inventory_items for select
using (is_admin() or is_manager());

-- Locations
drop policy if exists "Admins manage locations" on public.inventory_locations;
create policy "Admins manage locations"
on public.inventory_locations for all
using (is_admin()) with check (is_admin());

drop policy if exists "Managers can view locations" on public.inventory_locations;
create policy "Managers can view locations"
on public.inventory_locations for select
using (is_admin() or is_manager());

-- Transactions
drop policy if exists "Admins manage txns" on public.inventory_txns;
create policy "Admins manage txns"
on public.inventory_txns for all
using (is_admin()) with check (is_admin());

drop policy if exists "Managers can view txns" on public.inventory_txns;
create policy "Managers can view txns"
on public.inventory_txns for select
using (is_admin() or is_manager());
