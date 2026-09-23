-- ============================================================================
-- What each role may do.
--
-- Until now a role was a label: owner-only screens aside, everyone in an
-- organization could do everything. A seller hiring their first helper needs
-- the difference to be real, and real means enforced here — not by hiding a
-- button, which only stops people who do not know the address.
--
-- Ashraf's rules:
--   staff     — day to day work. No deleting products or customers, no changing
--               a selling price, no cancelling orders, no touching the courier
--               or channel connections the business runs on.
--   manager   — all of that, but not the money coming in from couriers.
--   owner     — everything, including recording what the courier paid.
-- ============================================================================

-- Manager or owner. Named for what it is used for rather than for the roles.
create or replace function public.is_org_manager(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and role in ('owner', 'manager')
  );
$$;

grant execute on function public.is_org_manager(uuid) to authenticated;

-- ---------------------------------------------------------------- deleting

-- Products and customers carry history. Removing one is a manager's call.
drop policy if exists "products_delete_member" on public.products;
create policy "products_delete_manager" on public.products
  for delete to authenticated using (public.is_org_manager(organization_id));

drop policy if exists "product_variants_delete_member" on public.product_variants;
create policy "product_variants_delete_manager" on public.product_variants
  for delete to authenticated using (public.is_org_manager(organization_id));

drop policy if exists "customers_delete_member" on public.customers;
create policy "customers_delete_manager" on public.customers
  for delete to authenticated using (public.is_org_manager(organization_id));

-- ---------------------------------------------------------------- connections

-- The courier and channel accounts are what the business runs on. Staff may see
-- them — they need to know which courier is connected — but not change them.
do $$
declare
  t text;
begin
  foreach t in array array['courier_accounts', 'channel_connections']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_insert_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_member', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_manager', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_manager', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_manager', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_org_manager(organization_id))',
      t || '_insert_manager', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_org_manager(organization_id)) with check (public.is_org_manager(organization_id))',
      t || '_update_manager', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_org_manager(organization_id))',
      t || '_delete_manager', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- the price

-- A price is one column among many a staff member legitimately edits, so this is
-- a trigger rather than a policy: everything else about a variant stays theirs.
create or replace function public.guard_variant_price()
returns trigger
language plpgsql
as $$
begin
  if new.selling_price is distinct from old.selling_price
    and not public.is_org_manager(new.organization_id) then
    raise exception 'ROLE_DENIED: only a manager or the owner can change a selling price'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists product_variants_guard_price on public.product_variants;
create trigger product_variants_guard_price
  before update on public.product_variants
  for each row execute function public.guard_variant_price();

-- ---------------------------------------------------------------- cancelling

-- Cancelling puts stock back and loses the sale, so it is the one move in the
-- state machine that staff cannot make. Every other transition is their work.
create or replace function public.guard_order_cancellation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
    and not public.is_service_role()
    and not public.is_org_manager(new.organization_id) then
    raise exception 'ROLE_DENIED: only a manager or the owner can cancel an order'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_cancellation on public.orders;
create trigger orders_guard_cancellation
  before update on public.orders
  for each row execute function public.guard_order_cancellation();

-- ---------------------------------------------------------------- the money

-- Recording a payout is saying "this money arrived". That is the cash book, and
-- it stays with the owner.
drop policy if exists "courier_payouts_update_member" on public.courier_payouts;
create policy "courier_payouts_update_owner" on public.courier_payouts
  for update to authenticated using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));

drop policy if exists "courier_payouts_delete_member" on public.courier_payouts;
create policy "courier_payouts_delete_owner" on public.courier_payouts
  for delete to authenticated using (public.is_org_owner(organization_id));

-- record_courier_payout() runs as its definer, so the policies above do not
-- apply inside it. The check has to be its own.
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

  if not public.is_org_owner(v_organization_id) then
    raise exception 'ROLE_DENIED: only the owner can record a payout'
      using errcode = 'insufficient_privilege';
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
