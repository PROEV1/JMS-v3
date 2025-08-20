
-- 1) Suppliers
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  contact_phone text,
  lead_time_days integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Inventory items
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  is_serialized boolean not null default false,
  barcode text,
  default_cost numeric not null default 0,
  unit text not null default 'ea',
  min_level integer not null default 0,
  max_level integer not null default 0,
  reorder_point integer not null default 0,
  supplier_id uuid references public.suppliers(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Inventory locations
-- location_type: 'warehouse' | 'van' | 'job_site' (text for flexibility)
create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  location_type text not null default 'warehouse',
  engineer_id uuid references public.engineers(id),
  order_id uuid references public.orders(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Inventory transactions
-- Convention: qty > 0 is inbound, qty < 0 is outbound
-- For moves, insert two rows: one negative from_location_id and one positive to_location_id
create table if not exists public.inventory_txns (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  item_id uuid not null references public.inventory_items(id),
  location_id uuid not null references public.inventory_locations(id),
  qty integer not null,
  txn_type text not null, -- receive | move_in | move_out | consume | adjust | return_in | return_out | rma_out | rma_in
  serial_id uuid references public.inventory_serials(id), -- forward-declared, added after serials table creation
  ref_type text, -- 'order' | 'po' | 'request' | etc
  ref_id uuid,   -- points to orders.id or other entities depending on ref_type
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- 5) Inventory serials
create table if not exists public.inventory_serials (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id),
  serial_number text not null unique,
  status text not null default 'in_stock', -- in_stock | installed | returned | rma_out | rma_in
  current_location_id uuid references public.inventory_locations(id),
  installed_on_order uuid references public.orders(id),
  installed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Now add the serial_id FK to inventory_txns (if not already present)
alter table public.inventory_txns
  drop column if exists serial_id;
alter table public.inventory_txns
  add column serial_id uuid references public.inventory_serials(id);

-- 6) Balances view (real-time on-hand per item/location)
create or replace view public.vw_item_location_balances as
select
  t.item_id,
  t.location_id,
  sum(t.qty)::int as on_hand
from public.inventory_txns t
group by t.item_id, t.location_id;

-- 7) Triggers to maintain updated_at
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

drop trigger if exists trg_inventory_serials_updated_at on public.inventory_serials;
create trigger trg_inventory_serials_updated_at
before update on public.inventory_serials
for each row execute function public.update_updated_at_column();

-- 8) RLS
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_serials enable row level security;
alter table public.inventory_txns enable row level security;

-- Suppliers policies
drop policy if exists "Admins manage suppliers" on public.suppliers;
create policy "Admins manage suppliers"
  on public.suppliers for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Anyone can read suppliers" on public.suppliers;
create policy "Anyone can read suppliers"
  on public.suppliers for select
  using (true);

-- Inventory items policies
drop policy if exists "Admins manage items" on public.inventory_items;
create policy "Admins manage items"
  on public.inventory_items for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Read active items" on public.inventory_items;
create policy "Read active items"
  on public.inventory_items for select
  using (is_active = true or is_admin());

-- Inventory locations policies
drop policy if exists "Admins manage locations" on public.inventory_locations;
create policy "Admins manage locations"
  on public.inventory_locations for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Engineers read van + warehouses" on public.inventory_locations;
create policy "Engineers read van + warehouses"
  on public.inventory_locations for select
  using (
    location_type = 'warehouse'
    or exists (
      select 1 from public.engineers e
      where e.user_id = auth.uid()
      and e.id = inventory_locations.engineer_id
    )
  );

-- Inventory serials policies
drop policy if exists "Admins manage serials" on public.inventory_serials;
create policy "Admins manage serials"
  on public.inventory_serials for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Engineers read van/installed serials" on public.inventory_serials;
create policy "Engineers read van/installed serials"
  on public.inventory_serials for select
  using (
    exists (
      select 1 from public.engineers e
      where e.user_id = auth.uid()
      and (
        inventory_serials.current_location_id in (
          select l.id from public.inventory_locations l
          where l.engineer_id = e.id and l.location_type = 'van'
        )
        or inventory_serials.installed_on_order in (
          select o.id from public.orders o
          join public.engineers e2 on e2.id = o.engineer_id
          where e2.user_id = auth.uid()
        )
      )
    )
    or is_admin()
  );

-- Inventory txns policies
drop policy if exists "Admins manage txns" on public.inventory_txns;
create policy "Admins manage txns"
  on public.inventory_txns for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "Engineers read own van txns" on public.inventory_txns;
create policy "Engineers read own van txns"
  on public.inventory_txns for select
  using (
    exists (
      select 1 from public.engineers e
      where e.user_id = auth.uid()
      and inventory_txns.location_id in (
        select l.id from public.inventory_locations l
        where l.engineer_id = e.id and l.location_type = 'van'
      )
    )
    or is_admin()
  );

-- 9) RPC: inv_consume
-- Engineers consume stock from their van to an assigned order
create or replace function public.inv_consume(
  p_order_id uuid,
  p_item_id uuid,
  p_qty integer,
  p_serial_ids uuid[] default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := public.is_admin();
  v_is_engineer boolean := public.user_is_engineer_for_order(p_order_id, auth.uid());
  v_engineer_id uuid;
  v_van_location_id uuid;
  v_is_serialized boolean;
  v_on_hand integer := 0;
  v_needed integer := greatest(coalesce(p_qty,0), 0);
  v_serial_id uuid;
begin
  if not (v_is_admin or v_is_engineer) then
    raise exception 'Not allowed to consume for this order';
  end if;

  -- Resolve engineer and van
  select public.get_engineer_id_for_user(auth.uid()) into v_engineer_id;

  if v_engineer_id is null and not v_is_admin then
    raise exception 'Engineer profile not found for user';
  end if;

  -- Find/create van location for the engineer (if consuming as engineer)
  if not v_is_admin then
    select id into v_van_location_id
    from public.inventory_locations
    where engineer_id = v_engineer_id
      and location_type = 'van'
      and is_active = true
    limit 1;

    if v_van_location_id is null then
      insert into public.inventory_locations (name, code, location_type, engineer_id, is_active)
      values ('Van', 'VAN-' || substr(v_engineer_id::text, 1, 8), 'van', v_engineer_id, true)
      returning id into v_van_location_id;
    end if;
  else
    -- Admins must still consume from some van; take the assigned engineer's van for the order if any
    select l.id into v_van_location_id
    from public.orders o
    join public.inventory_locations l on l.engineer_id = o.engineer_id and l.location_type = 'van' and l.is_active = true
    where o.id = p_order_id
    limit 1;

    if v_van_location_id is null then
      -- fallback: create a van for the assigned engineer if the order has one
      select o.engineer_id into v_engineer_id from public.orders o where o.id = p_order_id;
      if v_engineer_id is not null then
        insert into public.inventory_locations (name, code, location_type, engineer_id, is_active)
        values ('Van', 'VAN-' || substr(v_engineer_id::text, 1, 8), 'van', v_engineer_id, true)
        returning id into v_van_location_id;
      else
        raise exception 'No engineer/van found for this order';
      end if;
    end if;
  end if;

  -- Check if item is serialized
  select is_serialized into v_is_serialized from public.inventory_items where id = p_item_id;
  if v_is_serialized is null then
    raise exception 'Item not found';
  end if;

  if v_is_serialized then
    if p_serial_ids is null or array_length(p_serial_ids,1) is distinct from v_needed then
      raise exception 'Provide exactly % serial id(s) for a serialized item', v_needed;
    end if;

    -- Validate each serial is in the engineer van and in stock, then consume
    foreach v_serial_id in array p_serial_ids loop
      perform 1
      from public.inventory_serials s
      where s.id = v_serial_id
        and s.item_id = p_item_id
        and s.status = 'in_stock'
        and s.current_location_id = v_van_location_id;

      if not found then
        raise exception 'Serial % is not available in van or not in stock', v_serial_id;
      end if;

      -- Insert txn: outbound -1 from van
      insert into public.inventory_txns (
        item_id, location_id, qty, txn_type, serial_id, ref_type, ref_id, notes
      ) values (
        p_item_id, v_van_location_id, -1, 'consume', v_serial_id, 'order', p_order_id, 'Engineer consumed serialized item'
      );

      -- Update serial: installed on order
      update public.inventory_serials
      set status = 'installed',
          current_location_id = null,
          installed_on_order = p_order_id,
          installed_at = now(),
          updated_at = now()
      where id = v_serial_id;
    end loop;

    return true;
  else
    -- Non-serialized: verify on-hand
    select coalesce(sum(qty),0)::int into v_on_hand
    from public.inventory_txns
    where item_id = p_item_id and location_id = v_van_location_id;

    if v_on_hand < v_needed then
      raise exception 'Insufficient stock: on hand %, needed %', v_on_hand, v_needed;
    end if;

    -- Insert one outbound txn for the quantity
    insert into public.inventory_txns (
      item_id, location_id, qty, txn_type, ref_type, ref_id, notes
    ) values (
      p_item_id, v_van_location_id, -v_needed, 'consume', 'order', p_order_id, 'Engineer consumed non-serialized item'
    );

    return true;
  end if;
end;
$$;

-- Helpful indexes
create index if not exists idx_inventory_txns_item_location on public.inventory_txns(item_id, location_id);
create index if not exists idx_inventory_serials_item on public.inventory_serials(item_id);
create index if not exists idx_inventory_locations_engineer on public.inventory_locations(engineer_id);

