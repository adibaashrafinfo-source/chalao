-- ============================================================================
-- Returns: the other side of cash on delivery.
--
-- The order state machine already moves a parcel to "returned" and puts the
-- stock back. What it never recorded is what the return cost and whether the
-- goods are worth selling again — and those are the two things that decide
-- whether a seller is making money.
--
-- A refused parcel is not free. The courier is paid for carrying it out and
-- often for carrying it back, and the seller pays that out of nothing. Until it
-- is written down, the loss is invisible.
-- ============================================================================

do $$ begin
  create type public.return_reason as enum (
    'refused',        -- the customer would not take it
    'unreachable',    -- nobody there, phone off
    'wrong_address',
    'damaged',        -- came back damaged
    'changed_mind',
    'other'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.order_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- One return per order: a parcel comes back once.
  order_id uuid not null unique references public.orders (id) on delete cascade,
  shipment_id uuid references public.shipments (id) on delete set null,
  reason public.return_reason not null default 'other',
  -- What the courier charged for a parcel that sold nothing.
  return_charge numeric(12, 2) not null default 0 check (return_charge >= 0),
  -- False when the goods came back unsellable, which takes them out of stock again.
  restocked boolean not null default true,
  note text,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_returns_org_idx
  on public.order_returns (organization_id, created_at desc);

-- ---------------------------------------------------------------- recording one

-- Moves the order to returned when it has not moved yet, writes down what the
-- return cost, and takes the goods back out of stock when they came back
-- unsellable. One call, so the stock and the record cannot disagree.
create or replace function public.record_order_return(
  p_order_id uuid,
  p_reason public.return_reason,
  p_return_charge numeric,
  p_restock boolean,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_shipment_id uuid;
  v_item record;
  v_return_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found' using errcode = 'no_data_found';
  end if;

  if not public.is_org_member(v_order.organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.order_returns where order_id = p_order_id) then
    raise exception 'RETURN_ALREADY_RECORDED' using errcode = 'unique_violation';
  end if;

  -- The state machine decides whether this order may come back at all. When the
  -- courier webhook has already moved it, there is nothing left to move.
  if v_order.status <> 'returned' then
    perform public.transition_order_status(p_order_id, 'returned', p_note);
  end if;

  -- Goods that came back unsellable were just put back by that move, so take
  -- them out again as damage. The ledger then says what really happened twice
  -- over, rather than quietly skipping a step.
  if not coalesce(p_restock, true) then
    for v_item in
      select variant_id, quantity from public.order_items
      where order_id = p_order_id and variant_id is not null
    loop
      perform public.apply_inventory_movement(
        v_item.variant_id, 'damage', -v_item.quantity, p_order_id, 'Returned unsellable'
      );
    end loop;
  end if;

  select id into v_shipment_id from public.shipments where order_id = p_order_id limit 1;

  insert into public.order_returns (
    organization_id, order_id, shipment_id, reason, return_charge, restocked, note, recorded_by
  )
  values (
    v_order.organization_id, p_order_id, v_shipment_id,
    coalesce(p_reason, 'other'), coalesce(p_return_charge, 0), coalesce(p_restock, true),
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid()
  )
  returning id into v_return_id;

  return v_return_id;
end;
$$;

grant execute on function public.record_order_return(
  uuid, public.return_reason, numeric, boolean, text
) to authenticated;

-- ---------------------------------------------------------------- the numbers

-- What returns cost this calendar month, and how much of it is still sellable.
create or replace function public.returns_summary(p_organization_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_count integer;
  v_charges numeric;
  v_value numeric;
  v_unsellable integer;
  v_delivered integer;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  select
    count(*),
    coalesce(sum(r.return_charge), 0),
    coalesce(sum(o.total), 0),
    count(*) filter (where not r.restocked)
  into v_count, v_charges, v_value, v_unsellable
  from public.order_returns r
  join public.orders o on o.id = r.order_id
  where r.organization_id = p_organization_id
    and r.created_at >= date_trunc('month', now());

  -- Parcels that arrived this month, as something to read the return count against.
  select count(*) into v_delivered
  from public.orders
  where organization_id = p_organization_id
    and status = 'delivered'
    and delivered_at >= date_trunc('month', now());

  return jsonb_build_object(
    'count', v_count,
    'charges', v_charges,
    'order_value', v_value,
    'unsellable', v_unsellable,
    'delivered', v_delivered
  );
end;
$$;

grant execute on function public.returns_summary(uuid) to authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.order_returns enable row level security;

-- Readable by the team. Written by record_order_return() alone, which is what
-- keeps the stock movement and the record together.
drop policy if exists "order_returns_select_member" on public.order_returns;
create policy "order_returns_select_member" on public.order_returns
  for select to authenticated using (public.is_org_member(organization_id));

-- Correcting a mistyped charge is ordinary work; the order it belongs to is not
-- changeable here, so the link cannot be moved to another order.
drop policy if exists "order_returns_update_member" on public.order_returns;
create policy "order_returns_update_member" on public.order_returns
  for update to authenticated using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create or replace function public.forbid_return_relink()
returns trigger
language plpgsql
as $$
begin
  if new.order_id is distinct from old.order_id
    or new.organization_id is distinct from old.organization_id then
    raise exception 'A return stays with its order' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists order_returns_no_relink on public.order_returns;
create trigger order_returns_no_relink
  before update on public.order_returns
  for each row execute function public.forbid_return_relink();
