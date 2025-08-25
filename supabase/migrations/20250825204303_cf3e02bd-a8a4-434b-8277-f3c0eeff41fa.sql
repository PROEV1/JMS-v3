
-- 1) Product categories table
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Useful uniqueness constraint on name (case-insensitive)
create unique index if not exists product_categories_name_lower_key
  on public.product_categories (lower(name));

-- 2) RLS
alter table public.product_categories enable row level security;

-- Admins can manage everything
create policy if not exists "Admins manage product categories"
  on public.product_categories
  as permissive
  for all
  using (is_admin())
  with check (is_admin());

-- Anyone can read active categories; admins can read all
create policy if not exists "Read active product categories"
  on public.product_categories
  as permissive
  for select
  using (is_admin() OR (is_active = true));

-- 3) updated_at trigger
create or replace function public.product_categories_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_product_categories_touch_updated_at on public.product_categories;

create trigger trg_product_categories_touch_updated_at
before update on public.product_categories
for each row execute function public.product_categories_touch_updated_at();
