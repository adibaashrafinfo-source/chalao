-- =====================================================================
-- F-Commerce OS — Phase 1 schema
--
-- Written from the rules in PROJECT_BRIEF §9 (the original
-- f-commerce-os-schema.sql was not available):
--   * every tenant table carries organization_id, protected by RLS via is_org_member()
--   * stock changes ONLY through apply_inventory_movement()
--   * order status changes ONLY through transition_order_status()
--   * courier credentials ONLY as Supabase Vault references (vault_secret_id)
--   * order_status_history and inventory_movements are append-only ledgers
--
-- The last three are enforced by the database itself (guard triggers +
-- missing INSERT/UPDATE/DELETE policies), not just by convention.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists supabase_vault with schema vault;

-- =====================================================================
-- 1. Enums
-- =====================================================================

create type public.business_type as enum ('fashion', 'cosmetics', 'electronics', 'home', 'food', 'other');

create type public.member_role as enum ('owner', 'manager', 'staff');

-- Brief §8 state machine.
create type public.order_status as enum (
  'new',
  'confirmed',
  'processing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded'
);

create type public.order_source as enum (
  'facebook',
  'instagram',
  'whatsapp',
  'website',
  'phone',
  'manual',
  'daraz',
  'other'
);

create type public.inventory_movement_type as enum (
  'purchase',          -- stock received
  'order_out',         -- reserved/shipped against an order
  'order_return',      -- came back from a cancelled/returned order
  'manual_adjustment', -- explicit correction, requires a note
  'damage'
);

create type public.courier_provider as enum ('steadfast');

create type public.shipment_status as enum (
  'pending',
  'booked',
  'picked_up',
  'in_transit',
  'delivered',
  'partially_delivered',
  'returned',
  'cancelled',
  'unknown'
);

-- =====================================================================
-- 2. Shared helpers
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Membership helpers live in section 4, after the tables they read.

-- Blocks UPDATE/DELETE on append-only ledgers, for every role including service_role.
create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Table % is append-only; % is not allowed', tg_table_name, tg_op
    using errcode = 'check_violation';
end;
$$;

-- =====================================================================
-- 3. Profiles (mirrors auth.users)
-- =====================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- 4. Tenancy
-- =====================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  business_type public.business_type not null default 'other',
  -- per-org order numbering, bumped by the orders trigger
  order_seq bigint not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index on public.organization_members (user_id);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  facebook_page_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.stores (organization_id);

create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- Membership helpers. Defined here because their bodies are validated at creation
-- time and they read organization_members above.
-- SECURITY DEFINER so policies on organization_members don't recurse.
create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.org_role(p_organization_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.organization_members m
  where m.organization_id = p_organization_id
    and m.user_id = auth.uid();
$$;

create or replace function public.is_org_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.org_role(p_organization_id) = 'owner'::public.member_role;
$$;

-- =====================================================================
-- 5. Catalogue
-- =====================================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  sku text,
  category text,
  description text,
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create index on public.products (organization_id, is_active);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null default 'Default',
  sku text,
  -- Read-only from the application's point of view: only apply_inventory_movement() may change it.
  stock integer not null default 0 check (stock >= 0),
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create index on public.product_variants (product_id);
create index on public.product_variants (organization_id);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 6. Customers
-- =====================================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  phone text not null check (length(btrim(phone)) > 0),
  alt_phone text,
  email text,
  address text,
  district text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- phone is the lookup key for f-commerce sellers
  unique (organization_id, phone)
);

create index on public.customers (organization_id, created_at desc);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 7. Orders
-- =====================================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.stores (id) on delete set null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  order_number bigint not null,
  status public.order_status not null default 'new',
  source public.order_source not null default 'manual',
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  delivery_charge numeric(12, 2) not null default 0 check (delivery_charge >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  delivery_address text,
  district text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_number)
);

create index on public.orders (organization_id, created_at desc);
create index on public.orders (organization_id, status);
create index on public.orders (customer_id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  if new.order_number is null then
    update public.organizations
      set order_seq = order_seq + 1
      where id = new.organization_id
      returning order_seq into v_next;
    new.order_number := v_next;
  end if;
  return new;
end;
$$;

create trigger orders_assign_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

-- Status may only move through transition_order_status(), which sets this flag.
create or replace function public.guard_order_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.status_transition', true), '') <> 'on' then
    raise exception 'orders.status must be changed via transition_order_status()'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger orders_guard_status
  before update on public.orders
  for each row execute function public.guard_order_status();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  -- snapshots, so history stays correct if the catalogue changes later
  product_name text not null,
  variant_name text,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index on public.order_items (order_id);
create index on public.order_items (variant_id);

-- Append-only ledger.
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.order_status_history (order_id, created_at desc);

create trigger order_status_history_no_update
  before update or delete on public.order_status_history
  for each row execute function public.forbid_mutation();

-- =====================================================================
-- 8. Inventory
-- =====================================================================

-- Append-only ledger. Stock on product_variants is derived from these rows.
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  movement_type public.inventory_movement_type not null,
  quantity_change integer not null check (quantity_change <> 0),
  stock_after integer not null check (stock_after >= 0),
  order_id uuid references public.orders (id) on delete set null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.inventory_movements (organization_id, created_at desc);
create index on public.inventory_movements (variant_id, created_at desc);

create trigger inventory_movements_no_update
  before update or delete on public.inventory_movements
  for each row execute function public.forbid_mutation();

create or replace function public.guard_variant_stock()
returns trigger
language plpgsql
as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.inventory_movement', true), '') <> 'on' then
    raise exception 'product_variants.stock must be changed via apply_inventory_movement()'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger product_variants_guard_stock
  before update on public.product_variants
  for each row execute function public.guard_variant_stock();

-- =====================================================================
-- 9. Couriers & shipments
-- =====================================================================

create table public.courier_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider public.courier_provider not null,
  label text not null default 'Default',
  -- API credentials live in Supabase Vault; this is only the reference.
  -- No FK to vault.secrets: the postgres role has no REFERENCES privilege on that table.
  vault_secret_id uuid,
  is_active boolean not null default true,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, label)
);

create index on public.courier_accounts (organization_id);

create trigger courier_accounts_set_updated_at
  before update on public.courier_accounts
  for each row execute function public.set_updated_at();

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  courier_account_id uuid references public.courier_accounts (id) on delete set null,
  provider public.courier_provider not null,
  consignment_id text,
  tracking_code text,
  status public.shipment_status not null default 'pending',
  cod_amount numeric(12, 2) not null default 0 check (cod_amount >= 0),
  weight_grams integer check (weight_grams > 0),
  recipient_name text not null,
  recipient_phone text not null,
  recipient_address text not null,
  district text,
  booking_error text,
  last_event_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.shipments (organization_id, created_at desc);
create index on public.shipments (order_id);
create unique index shipments_provider_consignment_key
  on public.shipments (provider, consignment_id)
  where consignment_id is not null;

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

-- Append-only ledger of courier webhook callbacks.
create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  provider_status text,
  mapped_status public.shipment_status not null,
  payload jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index on public.shipment_events (shipment_id, occurred_at desc);

create trigger shipment_events_no_update
  before update or delete on public.shipment_events
  for each row execute function public.forbid_mutation();

-- =====================================================================
-- 10. Business functions
-- =====================================================================

-- Onboarding: organization + owner membership + default store, in one transaction.
create or replace function public.create_organization_with_owner(
  p_name text,
  p_business_type public.business_type default 'other'
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'Organization name is required' using errcode = 'check_violation';
  end if;

  insert into public.organizations (name, business_type)
  values (btrim(p_name), p_business_type)
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, auth.uid(), 'owner');

  insert into public.stores (organization_id, name)
  values (v_org.id, btrim(p_name));

  return v_org;
end;
$$;

-- The ONLY way stock changes. Updates the variant and writes the ledger row atomically.
create or replace function public.apply_inventory_movement(
  p_variant_id uuid,
  p_movement_type public.inventory_movement_type,
  p_quantity_change integer,
  p_order_id uuid default null,
  p_note text default null
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant public.product_variants;
  v_new_stock integer;
  v_movement public.inventory_movements;
begin
  if p_quantity_change = 0 then
    raise exception 'quantity_change must not be zero' using errcode = 'check_violation';
  end if;

  select * into v_variant
  from public.product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'Variant % not found', p_variant_id using errcode = 'no_data_found';
  end if;

  if not public.is_org_member(v_variant.organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  -- A manual correction must say why (Brief §6.5).
  if p_movement_type = 'manual_adjustment' and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'manual_adjustment requires a note' using errcode = 'check_violation';
  end if;

  v_new_stock := v_variant.stock + p_quantity_change;
  if v_new_stock < 0 then
    raise exception 'Insufficient stock: % available, % requested', v_variant.stock, abs(p_quantity_change)
      using errcode = 'check_violation';
  end if;

  perform set_config('app.inventory_movement', 'on', true);
  update public.product_variants
    set stock = v_new_stock
    where id = p_variant_id;
  perform set_config('app.inventory_movement', 'off', true);

  insert into public.inventory_movements (
    organization_id, variant_id, movement_type, quantity_change, stock_after, order_id, note, created_by
  )
  values (
    v_variant.organization_id, p_variant_id, p_movement_type, p_quantity_change, v_new_stock,
    p_order_id, nullif(btrim(coalesce(p_note, '')), ''), auth.uid()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

-- Allowed moves, exactly as Brief §8 defines them.
create or replace function public.order_status_can_move(
  p_from public.order_status,
  p_to public.order_status
)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'new'           then p_to in ('confirmed', 'cancelled')
    when 'confirmed'     then p_to in ('processing', 'cancelled')
    when 'processing'    then p_to = 'ready_to_ship'
    when 'ready_to_ship' then p_to = 'shipped'
    when 'shipped'       then p_to in ('delivered', 'returned')
    when 'delivered'     then p_to = 'refunded'
    else false
  end;
$$;

-- The ONLY way order status changes. Writes history and moves stock as a side effect.
create or replace function public.transition_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_from_status public.order_status;
  v_item record;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'no_data_found';
  end if;

  if not public.is_org_member(v_order.organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  v_from_status := v_order.status;

  if not public.order_status_can_move(v_from_status, p_new_status) then
    raise exception 'Invalid order status transition: % -> %', v_from_status, p_new_status
      using errcode = 'check_violation';
  end if;

  -- Stock leaves on confirmation and comes back if the order is cancelled or returned.
  if p_new_status = 'confirmed' then
    for v_item in
      select variant_id, quantity from public.order_items
      where order_id = p_order_id and variant_id is not null
    loop
      perform public.apply_inventory_movement(
        v_item.variant_id, 'order_out', -v_item.quantity, p_order_id, 'Order confirmed'
      );
    end loop;
  elsif p_new_status in ('cancelled', 'returned') and v_from_status <> 'new' then
    for v_item in
      select variant_id, quantity from public.order_items
      where order_id = p_order_id and variant_id is not null
    loop
      perform public.apply_inventory_movement(
        v_item.variant_id, 'order_return', v_item.quantity, p_order_id,
        format('Order %s', p_new_status)
      );
    end loop;
  end if;

  perform set_config('app.status_transition', 'on', true);
  update public.orders
    set status = p_new_status,
        confirmed_at = case when p_new_status = 'confirmed' then now() else confirmed_at end,
        shipped_at   = case when p_new_status = 'shipped'   then now() else shipped_at end,
        delivered_at = case when p_new_status = 'delivered' then now() else delivered_at end
    where id = p_order_id
    returning * into v_order;
  perform set_config('app.status_transition', 'off', true);

  insert into public.order_status_history (organization_id, order_id, from_status, to_status, note, changed_by)
  values (v_order.organization_id, p_order_id, v_from_status, p_new_status,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid());

  return v_order;
end;
$$;

-- =====================================================================
-- 11. Row Level Security
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.stores                enable row level security;
alter table public.products              enable row level security;
alter table public.product_variants      enable row level security;
alter table public.customers             enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.inventory_movements   enable row level security;
alter table public.courier_accounts      enable row level security;
alter table public.shipments             enable row level security;
alter table public.shipment_events       enable row level security;

-- Profiles: your own row only.
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Organizations: members read; owners rename. Creation goes through create_organization_with_owner().
create policy "organizations_select_member" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "organizations_update_owner" on public.organizations
  for update to authenticated using (public.is_org_owner(id)) with check (public.is_org_owner(id));

-- Membership: members see the team; owners manage it.
create policy "organization_members_select" on public.organization_members
  for select to authenticated using (public.is_org_member(organization_id));
create policy "organization_members_insert_owner" on public.organization_members
  for insert to authenticated with check (public.is_org_owner(organization_id));
create policy "organization_members_update_owner" on public.organization_members
  for update to authenticated using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
create policy "organization_members_delete_owner" on public.organization_members
  for delete to authenticated using (public.is_org_owner(organization_id));

-- Ordinary tenant tables: full access for members of the owning organization.
do $$
declare
  t text;
begin
  foreach t in array array[
    'stores', 'products', 'product_variants', 'customers',
    'orders', 'order_items', 'courier_accounts', 'shipments'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))',
      t || '_select_member', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_org_member(organization_id))',
      t || '_insert_member', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))',
      t || '_update_member', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_org_member(organization_id))',
      t || '_delete_member', t);
  end loop;
end;
$$;

-- Ledgers: readable by members, written only by the SECURITY DEFINER functions
-- and the webhook route (service_role). No INSERT/UPDATE/DELETE policy on purpose.
create policy "order_status_history_select_member" on public.order_status_history
  for select to authenticated using (public.is_org_member(organization_id));
create policy "inventory_movements_select_member" on public.inventory_movements
  for select to authenticated using (public.is_org_member(organization_id));
create policy "shipment_events_select_member" on public.shipment_events
  for select to authenticated using (public.is_org_member(organization_id));

-- =====================================================================
-- 12. Grants
-- =====================================================================

revoke all on function public.forbid_mutation() from public;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.org_role(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.order_status_can_move(public.order_status, public.order_status) to authenticated;
grant execute on function public.create_organization_with_owner(text, public.business_type) to authenticated;
grant execute on function public.apply_inventory_movement(
  uuid, public.inventory_movement_type, integer, uuid, text
) to authenticated;
grant execute on function public.transition_order_status(uuid, public.order_status, text) to authenticated;
