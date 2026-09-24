-- ============================================================================
-- Two questions a seller starts the day with.
--
--   "What needs me today?"          → morning_brief()
--   "Which courier should I use?"   → courier_performance()
--
-- The dashboard already lists individual alerts — this product is low, that
-- order has sat for a day. What it never said was the one-line version, and a
-- list of twenty items is not something anyone reads before opening the shop.
-- ============================================================================

create or replace function public.morning_brief(p_organization_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_to_confirm integer;
  v_stuck integer;
  v_low_stock integer;
  v_cod_outstanding numeric;
  v_cod_parcels integer;
  v_returns_to_record integer;
  v_unread integer;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_to_confirm
  from public.orders
  where organization_id = p_organization_id and status = 'new';

  -- Out with a courier and silent for three days. Two is normal in Bangladesh;
  -- three means someone should call.
  select count(*) into v_stuck
  from public.shipments
  where organization_id = p_organization_id
    and status not in ('delivered', 'returned', 'cancelled')
    and coalesce(last_event_at, created_at) < now() - interval '3 days';

  select count(*) into v_low_stock
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.organization_id = p_organization_id
    and v.is_active
    and p.is_active
    and v.stock < p.low_stock_threshold;

  select count(*), coalesce(sum(cod_amount), 0)
  into v_cod_parcels, v_cod_outstanding
  from public.cod_unsettled_shipments
  where organization_id = p_organization_id;

  -- Came back, but nobody wrote down what it cost.
  select count(*) into v_returns_to_record
  from public.orders o
  where o.organization_id = p_organization_id
    and o.status = 'returned'
    and not exists (select 1 from public.order_returns r where r.order_id = o.id);

  select coalesce(sum(unread_count), 0) into v_unread
  from public.conversations
  where organization_id = p_organization_id;

  return jsonb_build_object(
    'to_confirm', v_to_confirm,
    'stuck_parcels', v_stuck,
    'low_stock', v_low_stock,
    'cod_outstanding', v_cod_outstanding,
    'cod_parcels', v_cod_parcels,
    'returns_to_record', v_returns_to_record,
    'unread_messages', v_unread
  );
end;
$$;

grant execute on function public.morning_brief(uuid) to authenticated;

-- ---------------------------------------------------------------- couriers

-- How each courier actually performed, rather than what its rate card says.
-- Counted on parcels booked in the window, so a courier is judged on the same
-- period's work whether or not those parcels have arrived yet.
create or replace function public.courier_performance(
  p_organization_id uuid,
  p_from date,
  p_to date
)
returns table (
  courier_account_id uuid,
  label text,
  provider text,
  sent bigint,
  delivered bigint,
  returned bigint,
  in_flight bigint,
  return_rate numeric,
  avg_days numeric,
  cod_collected numeric,
  charges numeric
)
language plpgsql
stable
as $$
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    a.id,
    coalesce(a.label, s.provider::text),
    s.provider::text,
    count(*)::bigint,
    count(*) filter (where s.status = 'delivered')::bigint,
    count(*) filter (where s.status = 'returned')::bigint,
    count(*) filter (where s.status not in ('delivered', 'returned', 'cancelled'))::bigint,
    -- Out of the parcels that reached a conclusion, not out of everything sent.
    case
      when count(*) filter (where s.status in ('delivered', 'returned')) > 0
      then round(
        count(*) filter (where s.status = 'returned')::numeric
        / count(*) filter (where s.status in ('delivered', 'returned')) * 100
      )
      else 0
    end,
    -- Days from booking to the last update, for the ones that arrived.
    round(avg(
      case
        when s.status = 'delivered'
        then extract(epoch from (coalesce(s.last_event_at, s.updated_at) - s.created_at)) / 86400
      end
    )::numeric, 1),
    coalesce(sum(s.cod_amount) filter (where s.status = 'delivered'), 0),
    coalesce((
      select sum(pi.delivery_charge + pi.cod_fee - pi.adjustment)
      from public.courier_payout_items pi
      join public.shipments ps on ps.id = pi.shipment_id
      where ps.courier_account_id is not distinct from a.id
        and pi.organization_id = p_organization_id
        and ps.created_at::date between p_from and p_to
    ), 0)
  from public.shipments s
  left join public.courier_accounts a on a.id = s.courier_account_id
  where s.organization_id = p_organization_id
    and s.created_at::date between p_from and p_to
  group by a.id, a.label, s.provider
  order by 4 desc;
end;
$$;

grant execute on function public.courier_performance(uuid, date, date) to authenticated;
