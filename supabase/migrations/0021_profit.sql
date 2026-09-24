-- ============================================================================
-- Profit: the number nobody has.
--
-- Every piece has been in here for a while — what was sold, what it cost to buy,
-- what the courier took, what the returns cost, and where a payout came up
-- short. Nothing has ever added them up.
--
-- Two decisions worth stating:
--
-- 1. An order item now remembers what the goods cost at the time it was sold.
--    Reading today's cost price would quietly rewrite last month's profit every
--    time a supplier changes a price.
-- 2. Only delivered orders count as revenue. An order that is confirmed but
--    still in a courier's van has not earned anything yet, and in this business
--    a good share of them never will.
-- ============================================================================

alter table public.order_items
  add column if not exists unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0);

-- Existing lines get the cost the variant carries now. It is the best guess
-- available for orders placed before this column existed, and it stops moving
-- from here on.
update public.order_items i
set unit_cost = v.cost_price
from public.product_variants v
where i.variant_id = v.id
  and i.unit_cost = 0;

-- ---------------------------------------------------------------- the summary

create or replace function public.profit_summary(
  p_organization_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_revenue numeric := 0;
  v_cogs numeric := 0;
  v_delivered integer := 0;
  v_courier numeric := 0;
  v_returns numeric := 0;
  v_returned integer := 0;
  v_cod_difference numeric := 0;
  v_net numeric;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  -- Revenue and the goods behind it, from parcels that actually arrived.
  select count(*), coalesce(sum(o.total), 0)
  into v_delivered, v_revenue
  from public.orders o
  where o.organization_id = p_organization_id
    and o.status = 'delivered'
    and o.delivered_at::date between p_from and p_to;

  select coalesce(sum(i.unit_cost * i.quantity), 0)
  into v_cogs
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.organization_id = p_organization_id
    and o.status = 'delivered'
    and o.delivered_at::date between p_from and p_to;

  -- What the courier kept out of the money it collected, for those same parcels.
  select coalesce(sum(pi.delivery_charge + pi.cod_fee - pi.adjustment), 0)
  into v_courier
  from public.courier_payout_items pi
  join public.orders o on o.id = pi.order_id
  where pi.organization_id = p_organization_id
    and o.status = 'delivered'
    and o.delivered_at::date between p_from and p_to;

  -- What came back, and what carrying it cost.
  select count(*), coalesce(sum(r.return_charge), 0)
  into v_returned, v_returns
  from public.order_returns r
  where r.organization_id = p_organization_id
    and r.created_at::date between p_from and p_to;

  -- Payouts that did not add up. Negative means the courier paid less than the
  -- parcels in it should have come to.
  select coalesce(sum(p.amount_received - coalesce(lines.expected, 0)), 0)
  into v_cod_difference
  from public.courier_payouts p
  left join lateral (
    select sum(pi.net_amount) as expected
    from public.courier_payout_items pi
    where pi.payout_id = p.id
  ) lines on true
  where p.organization_id = p_organization_id
    and p.paid_on between p_from and p_to;

  v_net := v_revenue - v_cogs - v_courier - v_returns + v_cod_difference;

  return jsonb_build_object(
    'revenue', v_revenue,
    'cogs', v_cogs,
    'gross_profit', v_revenue - v_cogs,
    'courier_charges', v_courier,
    'return_charges', v_returns,
    'cod_difference', v_cod_difference,
    'net_profit', v_net,
    'delivered_orders', v_delivered,
    'returned_orders', v_returned,
    'margin', case when v_revenue > 0 then round((v_net / v_revenue) * 100, 1) else 0 end
  );
end;
$$;

grant execute on function public.profit_summary(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------- by product

-- Which products actually made the money, rather than which sold the most.
create or replace function public.product_profit(
  p_organization_id uuid,
  p_from date,
  p_to date
)
returns table (
  product_name text,
  variant_name text,
  quantity bigint,
  revenue numeric,
  cost numeric,
  profit numeric
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
    i.product_name,
    i.variant_name,
    sum(i.quantity)::bigint,
    sum(i.line_total),
    sum(i.unit_cost * i.quantity),
    sum(i.line_total) - sum(i.unit_cost * i.quantity)
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.organization_id = p_organization_id
    and o.status = 'delivered'
    and o.delivered_at::date between p_from and p_to
  group by i.product_name, i.variant_name
  order by 6 desc
  limit 10;
end;
$$;

grant execute on function public.product_profit(uuid, date, date) to authenticated;
