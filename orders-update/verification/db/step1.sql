-- Bar Manager: step 1, order tables only.
-- RLS enabled with no policies: client access is denied until policies are configured.
begin;

create table if not exists public.order_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  minimum_order_amount numeric(12,2) not null default 0 check (minimum_order_amount >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.order_suppliers(id) on delete restrict,
  name text not null,
  category text,
  unit text not null default 'шт',
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_products_supplier_idx on public.order_products(supplier_id);
create index if not exists order_products_category_idx on public.order_products(category);

create table if not exists public.weekly_orders (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  created_by uuid not null references auth.users(id),
  status text not null default 'draft' check (status in ('draft','submitted','revision_requested','approved','cancelled')),
  manager_id uuid references auth.users(id),
  manager_comment text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists weekly_orders_creator_idx on public.weekly_orders(created_by);
create index if not exists weekly_orders_status_idx on public.weekly_orders(status);

create table if not exists public.weekly_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.weekly_orders(id) on delete cascade,
  product_id uuid not null references public.order_products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),
  product_name_snapshot text not null,
  supplier_id_snapshot uuid not null references public.order_suppliers(id),
  supplier_name_snapshot text not null,
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);
create index if not exists weekly_order_items_order_idx on public.weekly_order_items(order_id);

alter table public.order_suppliers enable row level security;
alter table public.order_products enable row level security;
alter table public.weekly_orders enable row level security;
alter table public.weekly_order_items enable row level security;

commit;
