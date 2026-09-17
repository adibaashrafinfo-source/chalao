-- Two gaps found while testing phase 1:
--
-- 1. Moving an organization back to a free plan left the old period end date behind,
--    so a free seller could read as "expired". A plan that costs nothing never expires.
-- 2. admin_set_subscription had no way to clear the period dates at all, because every
--    field used coalesce() to keep the previous value.

create or replace function public.subscription_state(p_organization_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.organization_subscriptions;
  v_price numeric;
begin
  select * into v_row from public.organization_subscriptions where organization_id = p_organization_id;
  if not found then return 'expired'; end if;

  if v_row.status = 'suspended' then return 'suspended'; end if;

  -- A free plan carries no period: it stays active whatever dates are left over.
  select monthly_price into v_price from public.subscription_plans where code = v_row.plan_code;
  if coalesce(v_price, 0) = 0 then return 'active'; end if;

  if v_row.current_period_end is null then return 'active'; end if;
  if current_date <= v_row.current_period_end then return 'active'; end if;
  if current_date <= v_row.current_period_end + public.subscription_grace_days() then return 'grace'; end if;
  return 'expired';
end;
$$;

create or replace function public.admin_set_subscription(
  p_organization_id uuid,
  p_plan_code text default null,
  p_status public.subscription_status default null,
  p_period_end date default null,
  p_note text default null,
  p_clear_period boolean default false
)
returns public.organization_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.organization_subscriptions;
  v_before public.organization_subscriptions;
  v_new_plan text;
  v_price numeric;
  v_clear boolean;
begin
  if not (public.is_platform_admin() or public.is_service_role()) then
    raise exception 'Platform admin only' using errcode = 'insufficient_privilege';
  end if;

  select * into v_before from public.organization_subscriptions
  where organization_id = p_organization_id for update;

  if not found then
    insert into public.organization_subscriptions (organization_id, plan_code)
    values (p_organization_id, coalesce(p_plan_code, 'free'))
    returning * into v_before;
  end if;

  v_new_plan := coalesce(p_plan_code, v_before.plan_code);
  select monthly_price into v_price from public.subscription_plans where code = v_new_plan;

  -- Dropping to a free plan wipes the dates, so nothing stale is left behind.
  v_clear := p_clear_period or coalesce(v_price, 0) = 0;

  update public.organization_subscriptions
    set plan_code = v_new_plan,
        status = coalesce(p_status, status),
        current_period_end = case
          when v_clear then null
          else coalesce(p_period_end, current_period_end)
        end,
        current_period_start = case
          when v_clear then null
          when p_period_end is not null and current_period_start is null then current_date
          else current_period_start
        end,
        note = coalesce(p_note, note)
    where organization_id = p_organization_id
    returning * into v_row;

  insert into public.subscription_events (organization_id, event_type, detail, note, actor)
  values (
    p_organization_id,
    'subscription_changed',
    jsonb_build_object(
      'from_plan', v_before.plan_code, 'to_plan', v_row.plan_code,
      'from_status', v_before.status, 'to_status', v_row.status,
      'from_period_end', v_before.current_period_end, 'to_period_end', v_row.current_period_end
    ),
    p_note,
    auth.uid()
  );

  return v_row;
end;
$$;

grant execute on function public.admin_set_subscription(
  uuid, text, public.subscription_status, date, text, boolean
) to authenticated;

-- Clean up any free subscription still carrying a period date.
update public.organization_subscriptions s
  set current_period_start = null, current_period_end = null
  from public.subscription_plans p
  where p.code = s.plan_code
    and p.monthly_price = 0
    and (s.current_period_end is not null or s.current_period_start is not null);
