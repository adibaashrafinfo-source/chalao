-- Phase 6: make the plan mean something.
--
-- A new order is refused when the subscription is suspended, when it expired more
-- than the grace days ago, or when the plan's monthly order allowance is used up.
-- Everything already in the app stays readable — only creating new orders stops.
--
-- The check lives in a trigger, so hiding a button is not what enforces it. The same
-- rules are exposed through subscription_order_gate() so screens can explain the
-- situation before the seller fills in a form.

create or replace function public.subscription_order_gate(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_state text;
  v_limit integer;
  v_used integer;
begin
  if not (public.is_org_member(p_organization_id) or public.is_platform_admin() or public.is_service_role()) then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;

  v_state := public.subscription_state(p_organization_id);

  select p.order_limit into v_limit
  from public.organization_subscriptions s
  join public.subscription_plans p on p.code = s.plan_code
  where s.organization_id = p_organization_id;

  v_used := public.subscription_orders_this_month(p_organization_id);

  return jsonb_build_object(
    'state', v_state,
    'order_limit', v_limit,
    'orders_this_month', v_used,
    'allowed', case
      when v_state in ('suspended', 'expired') then false
      when v_limit is not null and v_used >= v_limit then false
      else true
    end,
    'reason', case
      when v_state = 'suspended' then 'SUBSCRIPTION_SUSPENDED'
      when v_state = 'expired' then 'SUBSCRIPTION_EXPIRED'
      when v_limit is not null and v_used >= v_limit then 'ORDER_LIMIT_REACHED'
      else null
    end
  );
end;
$$;

-- The messages are codes rather than sentences: the app turns them into wording the
-- seller reads, in whichever language that screen uses.
create or replace function public.enforce_subscription_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text;
  v_limit integer;
  v_used integer;
begin
  -- Server-side work (courier webhooks, admin tooling) is not subject to the seller's plan.
  if public.is_service_role() then
    return new;
  end if;

  v_state := public.subscription_state(new.organization_id);

  if v_state = 'suspended' then
    raise exception 'SUBSCRIPTION_SUSPENDED' using errcode = 'check_violation';
  end if;

  if v_state = 'expired' then
    raise exception 'SUBSCRIPTION_EXPIRED' using errcode = 'check_violation';
  end if;

  select p.order_limit into v_limit
  from public.organization_subscriptions s
  join public.subscription_plans p on p.code = s.plan_code
  where s.organization_id = new.organization_id;

  if v_limit is not null then
    select count(*) into v_used
    from public.orders
    where organization_id = new.organization_id
      and created_at >= date_trunc('month', now());

    if v_used >= v_limit then
      raise exception 'ORDER_LIMIT_REACHED' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enforce_subscription on public.orders;
create trigger orders_enforce_subscription
  before insert on public.orders
  for each row execute function public.enforce_subscription_on_order();

grant execute on function public.subscription_order_gate(uuid) to authenticated;
