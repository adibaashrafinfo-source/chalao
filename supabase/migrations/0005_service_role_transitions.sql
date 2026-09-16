-- Courier webhooks arrive with no user session: they authenticate with the account's
-- webhook token and then run as service_role, which has no auth.uid(). The membership
-- checks inside transition_order_status() and apply_inventory_movement() would reject
-- that, so both now also accept the service role.
--
-- This does NOT widen access for signed-in users: is_org_member() still governs them,
-- and the service role key never leaves the server.

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role';
$$;

grant execute on function public.is_service_role() to authenticated, service_role;

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

  if not (public.is_org_member(v_variant.organization_id) or public.is_service_role()) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

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

  if not (public.is_org_member(v_order.organization_id) or public.is_service_role()) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  v_from_status := v_order.status;

  if not public.order_status_can_move(v_from_status, p_new_status) then
    raise exception 'Invalid order status transition: % -> %', v_from_status, p_new_status
      using errcode = 'check_violation';
  end if;

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

grant execute on function public.apply_inventory_movement(
  uuid, public.inventory_movement_type, integer, uuid, text
) to authenticated, service_role;
grant execute on function public.transition_order_status(uuid, public.order_status, text) to authenticated, service_role;
