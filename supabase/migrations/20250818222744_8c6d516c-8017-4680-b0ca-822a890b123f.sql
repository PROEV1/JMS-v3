
-- 1) Core partner entities
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  base_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-updated timestamps
create trigger trg_partners_updated_at
before update on public.partners
for each row execute function public.update_updated_at_column();

alter table public.partners enable row level security;

-- Admins can manage partners
create policy "Admins can manage partners"
  on public.partners for all
  using (get_user_role(auth.uid()) = 'admin')
  with check (get_user_role(auth.uid()) = 'admin');

-- Allow managers to view partners
create policy "Managers can view partners"
  on public.partners for select
  using (get_user_role(auth.uid()) = any (array['admin','manager']::user_role[]));


-- 2) Import profiles per partner
create table if not exists public.partner_import_profiles (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  name text not null,
  source_type text not null check (source_type in ('csv','gsheet')),
  gsheet_id text,
  gsheet_sheet_name text,
  column_mappings jsonb not null default '{}'::jsonb,          -- e.g. { "partner_status": "Status", "scheduled_date": "Install Date", ... }
  status_mappings jsonb not null default '{}'::jsonb,          -- e.g. { "AWAITING_INSTALL_DATE": "awaiting_install_booking", ... } (partner->internal codes)
  engineer_mapping_rules jsonb not null default '[]'::jsonb,    -- e.g. [ { "region": "London", "starting_postcode_prefix": "SW", "engineer_id": "..." } ]
  status_override_rules jsonb not null default '{}'::jsonb,     -- e.g. { "ON_HOLD": true, "CANCELLATION_REQUESTED": true }
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_import_profiles_partner_id on public.partner_import_profiles(partner_id);

create trigger trg_partner_import_profiles_updated_at
before update on public.partner_import_profiles
for each row execute function public.update_updated_at_column();

alter table public.partner_import_profiles enable row level security;

-- Admins can manage profiles
create policy "Admins can manage import profiles"
  on public.partner_import_profiles for all
  using (get_user_role(auth.uid()) = 'admin')
  with check (get_user_role(auth.uid()) = 'admin');

-- Managers can view profiles
create policy "Managers can view import profiles"
  on public.partner_import_profiles for select
  using (get_user_role(auth.uid()) = any (array['admin','manager']::user_role[]));


-- 3) Import logs and auditing
create table if not exists public.partner_import_logs (
  id uuid primary key default gen_random_uuid(),
  run_id text unique,                                 -- for idempotence/tracking
  partner_id uuid not null references public.partners(id) on delete cascade,
  profile_id uuid references public.partner_import_profiles(id) on delete set null,
  dry_run boolean not null default true,
  total_rows integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_import_logs_partner_id on public.partner_import_logs(partner_id);
create index if not exists idx_partner_import_logs_profile_id on public.partner_import_logs(profile_id);

alter table public.partner_import_logs enable row level security;

-- Admins and managers can view logs
create policy "Admins and managers can view import logs"
  on public.partner_import_logs for select
  using (get_user_role(auth.uid()) = any (array['admin','manager']::user_role[]));

-- Admins can insert logs
create policy "Admins can insert import logs"
  on public.partner_import_logs for insert
  with check (get_user_role(auth.uid()) = 'admin');


-- 4) Extend orders for partner job linkage and flow suppression
-- Note: is_partner_job already exists in your schema
alter table public.orders
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  add column if not exists sub_partner text,                         -- e.g., dealership name
  add column if not exists partner_external_id text,                 -- partner's job id
  add column if not exists partner_external_url text,                -- deeplink to open in partner JMS
  add column if not exists partner_status text,                      -- normalized partner status after mapping
  add column if not exists partner_status_raw text,                  -- raw incoming partner status as received
  add column if not exists partner_confirmed_externally boolean default false,
  add column if not exists partner_confirmed_at timestamptz,
  add column if not exists external_confirmation_source text,        -- e.g., "partner_jms"
  add column if not exists partner_metadata jsonb not null default '{}'::jsonb,
  add column if not exists scheduling_suppressed boolean not null default false,     -- ON_HOLD / CANCELLATION_REQUESTED -> true
  add column if not exists scheduling_suppressed_reason text;

-- Helpful indexes
create index if not exists idx_orders_partner_id on public.orders(partner_id);
create index if not exists idx_orders_is_partner_job on public.orders(is_partner_job);
create unique index if not exists ux_orders_partner_job on public.orders (partner_id, partner_external_id) where partner_external_id is not null;

-- 5) Helper function to log partner import (optional convenience)
create or replace function public.log_partner_import(
  p_run_id text,
  p_partner_id uuid,
  p_profile_id uuid,
  p_dry_run boolean,
  p_total_rows int,
  p_inserted_count int,
  p_updated_count int,
  p_skipped_count int,
  p_warnings jsonb default '[]'::jsonb,
  p_errors jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path to public
as $$
declare v_id uuid;
begin
  insert into public.partner_import_logs (
    run_id, partner_id, profile_id, dry_run, total_rows,
    inserted_count, updated_count, skipped_count, warnings, errors, created_by
  ) values (
    p_run_id, p_partner_id, p_profile_id, p_dry_run, p_total_rows,
    p_inserted_count, p_updated_count, p_skipped_count, p_warnings, p_errors, auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Note: existing RLS on orders stays intact (user_can_view_order).
-- UI will exclude scheduling_suppressed=true from active scheduling buckets.
