-- ============================================================================
-- Cash on delivery reconciliation.
--
-- The courier collects the money from the customer, keeps it for a week or two,
-- then pays a lump sum minus its own charges. The seller's question is never
-- "how much did I sell" — it is "which parcels have I actually been paid for,
-- and does this payout add up".
--
-- So two records: the payment that arrived, and the parcels it covered. The
-- difference between them is shown rather than hidden, because that difference
-- is the whole reason a seller does this by hand today.
--
-- One rule matters more than the rest: a parcel's money can be counted once.
-- ============================================================================

create table if not exists public.courier_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  courier_account_id uuid references public.courier_accounts (id) on delete set null,
  provider public.courier_provider not null,
  -- The courier's own statement or transaction number, so a disagreement can be
  -- taken back to them with a reference.
  reference text,
  paid_on date not null default current_date,
  -- What actually arrived, not what should have.
  amount_received numeric(12, 2) not null check (amount_received >= 0),
  method text not null default 'bank' check (method in ('bank', 'bkash', 'nagad', 'cash', 'other')),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courier_payouts_org_idx
  on public.courier_payouts (organization_id, paid_on desc);

drop trigger if exists courier_payouts_set_updated_at on public.courier_payouts;
create trigger courier_payouts_set_updated_at
  before update on public.courier_payouts
  for each row execute function public.set_updated_at();

create table if not exists public.courier_payout_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  payout_id uuid not null references public.courier_payouts (id) on delete cascade,
  -- Restrict, not cascade: a parcel whose money has been counted is part of the
  -- books now, the same way an order with a ledger cannot be deleted.
  shipment_id uuid not null references public.shipments (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  cod_amount numeric(12, 2) not null check (cod_amount >= 0),
  delivery_charge numeric(12, 2) not null default 0 check (delivery_charge >= 0),
  cod_fee numeric(12, 2) not null default 0 check (cod_fee >= 0),
  -- Anything else the courier added or took off, which is where the arguments are.
  adjustment numeric(12, 2) not null default 0,
  net_amount numeric(12, 2) generated always as
    (cod_amount - delivery_charge - cod_fee + adjustment) stored,
  created_at timestamptz not null default now()
);

create index if not exists courier_payout_items_payout_idx
  on public.courier_payout_items (payout_id);

-- The rule that stops the same parcel being counted in two payouts.
create unique index if not exists courier_payout_items_shipment_key
  on public.courier_payout_items (shipment_id);

-- A line may be added or removed with its payout, never quietly rewritten.
create or replace function public.forbid_payout_item_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'A payout line cannot be edited. Remove the payout and record it again.'
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists courier_payout_items_no_update on public.courier_payout_items;
create trigger courier_payout_items_no_update
  before update on public.courier_payout_items
  for each row execute function public.forbid_payout_item_update();

-- ---------------------------------------------------------------- what is owed

-- Delivered parcels whose money has not been accounted for yet. security_invoker
-- so it is read under the caller's own row level security, not the view owner's.
create or replace view public.cod_unsettled_shipments
with (security_invoker = true) as
select
  s.id as shipment_id,
  s.organization_id,
  s.order_id,
  o.order_number,
  s.provider,
  s.courier_account_id,
  s.consignment_id,
  s.tracking_code,
  s.cod_amount,
  s.recipient_name,
  s.district,
  s.last_event_at,
  s.created_at
from public.shipments s
join public.orders o on o.id = s.order_id
where s.status = 'delivered'
  and not exists (
    select 1 from public.courier_payout_items i where i.shipment_id = s.id
  );

grant select on public.cod_unsettled_shipments to authenticated;

-- One call for the numbers at the top of the COD screen.
create or replace function public.cod_summary(p_organization_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_outstanding_count integer;
  v_outstanding_amount numeric;
  v_expected numeric;
  v_received numeric;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  select count(*), coalesce(sum(cod_amount), 0)
  into v_outstanding_count, v_outstanding_amount
  from public.cod_unsettled_shipments
  where organization_id = p_organization_id;

  select coalesce(sum(net_amount), 0) into v_expected
  from public.courier_payout_items
  where organization_id = p_organization_id;

  select coalesce(sum(amount_received), 0) into v_received
  from public.courier_payouts
  where organization_id = p_organization_id;

  return jsonb_build_object(
    'outstanding_count', v_outstanding_count,
    'outstanding_amount', v_outstanding_amount,
    'expected_total', v_expected,
    'received_total', v_received,
    'difference', v_received - v_expected
  );
end;
$$;

grant execute on function public.cod_summary(uuid) to authenticated;

-- ---------------------------------------------------------------- recording one

-- A payout and the parcels it covers, written together or not at all. Doing this
-- in the application would leave a payout with half its lines behind whenever a
-- parcel turned out to be already settled.
create or replace function public.record_courier_payout(
  p_courier_account_id uuid,
  p_provider public.courier_provider,
  p_paid_on date,
  p_amount_received numeric,
  p_method text,
  p_reference text,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_payout_id uuid;
  v_item jsonb;
  v_shipment public.shipments;
begin
  -- The organization comes from the courier account when there is one, and from
  -- the caller's membership otherwise. It is never taken from the request.
  if p_courier_account_id is not null then
    select organization_id into v_organization_id
    from public.courier_accounts where id = p_courier_account_id;
  end if;

  if v_organization_id is null then
    select organization_id into v_organization_id
    from public.organization_members where user_id = auth.uid() limit 1;
  end if;

  if v_organization_id is null or not public.is_org_member(v_organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'A payout must cover at least one parcel' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.courier_payouts (
    organization_id, courier_account_id, provider, reference, paid_on,
    amount_received, method, note, created_by
  )
  values (
    v_organization_id, p_courier_account_id, p_provider,
    nullif(btrim(coalesce(p_reference, '')), ''), coalesce(p_paid_on, current_date),
    p_amount_received, coalesce(p_method, 'bank'),
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid()
  )
  returning id into v_payout_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_shipment
    from public.shipments
    where id = (v_item ->> 'shipment_id')::uuid;

    if not found then
      raise exception 'Parcel not found' using errcode = 'no_data_found';
    end if;

    if v_shipment.organization_id <> v_organization_id then
      raise exception 'That parcel belongs to another organization' using errcode = 'insufficient_privilege';
    end if;

    if v_shipment.status <> 'delivered' then
      raise exception 'Parcel % has not been delivered yet', coalesce(v_shipment.consignment_id, v_shipment.id::text)
        using errcode = 'check_violation';
    end if;

    -- The unique index would catch this too; saying it in words is kinder.
    if exists (select 1 from public.courier_payout_items where shipment_id = v_shipment.id) then
      raise exception 'Parcel % is already settled in another payout',
        coalesce(v_shipment.consignment_id, v_shipment.id::text)
        using errcode = 'unique_violation';
    end if;

    insert into public.courier_payout_items (
      organization_id, payout_id, shipment_id, order_id,
      cod_amount, delivery_charge, cod_fee, adjustment
    )
    values (
      v_organization_id, v_payout_id, v_shipment.id, v_shipment.order_id,
      v_shipment.cod_amount,
      coalesce((v_item ->> 'delivery_charge')::numeric, 0),
      coalesce((v_item ->> 'cod_fee')::numeric, 0),
      coalesce((v_item ->> 'adjustment')::numeric, 0)
    );
  end loop;

  return v_payout_id;
end;
$$;

grant execute on function public.record_courier_payout(
  uuid, public.courier_provider, date, numeric, text, text, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.courier_payouts      enable row level security;
alter table public.courier_payout_items enable row level security;

-- Payouts are hand-entered, so a mistyped one has to be removable. Removing it
-- takes its lines with it and puts those parcels back on the unpaid list.
drop policy if exists "courier_payouts_select_member" on public.courier_payouts;
create policy "courier_payouts_select_member" on public.courier_payouts
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "courier_payouts_update_member" on public.courier_payouts;
create policy "courier_payouts_update_member" on public.courier_payouts
  for update to authenticated using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "courier_payouts_delete_member" on public.courier_payouts;
create policy "courier_payouts_delete_member" on public.courier_payouts
  for delete to authenticated using (public.is_org_member(organization_id));

-- No INSERT policy on purpose: payouts are created by record_courier_payout(),
-- which is the only place that checks the parcels before counting their money.

-- Lines are readable, and written only by that same function.
drop policy if exists "courier_payout_items_select_member" on public.courier_payout_items;
create policy "courier_payout_items_select_member" on public.courier_payout_items
  for select to authenticated using (public.is_org_member(organization_id));
