-- Two things, both found while testing:
--
-- 1. 0008 added a parameter to admin_set_subscription, which created a second
--    function rather than replacing the first. PostgREST then refused to choose
--    between them ("300 Multiple Choices"). Drop the old signature.
--
-- 2. A platform admin could not see other organizations at all: RLS on
--    `organizations` only lets members read their own, and owner emails live in
--    auth.users, which clients cannot read. The admin panel therefore goes through
--    these two functions instead, which return only what the panel needs:
--    who the seller is, what plan they are on, how much they use. Never their
--    orders, customers or products.

drop function if exists public.admin_set_subscription(uuid, text, public.subscription_status, date, text);

-- ---------------------------------------------------------------- directory

create or replace function public.admin_list_organizations(p_search text default null)
returns table (
  organization_id uuid,
  name text,
  business_type text,
  created_at timestamptz,
  owner_email text,
  member_count integer,
  plan_code text,
  plan_name text,
  monthly_price numeric,
  order_limit integer,
  status text,
  state text,
  period_end date,
  orders_this_month integer,
  orders_total integer,
  pending_submissions integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_platform_admin() or public.is_service_role()) then
    raise exception 'Platform admin only' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    o.id,
    o.name,
    o.business_type::text,
    o.created_at,
    owner.email::text,
    (select count(*)::integer from public.organization_members m where m.organization_id = o.id),
    coalesce(s.plan_code, 'free'),
    coalesce(p.name, 'Free'),
    coalesce(p.monthly_price, 0),
    p.order_limit,
    coalesce(s.status::text, 'active'),
    public.subscription_state(o.id),
    s.current_period_end,
    public.subscription_orders_this_month(o.id),
    (select count(*)::integer from public.orders ord where ord.organization_id = o.id),
    (select count(*)::integer from public.payment_submissions ps
      where ps.organization_id = o.id and ps.status = 'pending')
  from public.organizations o
  left join public.organization_subscriptions s on s.organization_id = o.id
  left join public.subscription_plans p on p.code = s.plan_code
  left join lateral (
    select u.email
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = o.id and m.role = 'owner'
    order by m.created_at
    limit 1
  ) owner on true
  where p_search is null
     or btrim(p_search) = ''
     or o.name ilike '%' || btrim(p_search) || '%'
     or owner.email ilike '%' || btrim(p_search) || '%'
  order by o.created_at desc;
end;
$$;

create or replace function public.admin_organization_detail(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if not (public.is_platform_admin() or public.is_service_role()) then
    raise exception 'Platform admin only' using errcode = 'insufficient_privilege';
  end if;

  select to_jsonb(t) into v_row
  from public.admin_list_organizations() t
  where t.organization_id = p_organization_id;

  if v_row is null then
    return null;
  end if;

  -- Counts only: never the contents of a seller's orders or customer list.
  return v_row || jsonb_build_object(
    'product_count', (select count(*) from public.products where organization_id = p_organization_id),
    'customer_count', (select count(*) from public.customers where organization_id = p_organization_id),
    'courier_count', (select count(*) from public.courier_accounts where organization_id = p_organization_id),
    'last_order_at', (select max(created_at) from public.orders where organization_id = p_organization_id),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'role', m.role) order by m.created_at), '[]'::jsonb)
      from public.organization_members m
      join auth.users u on u.id = m.user_id
      where m.organization_id = p_organization_id
    )
  );
end;
$$;

-- Every pending payment claim, newest first, for the admin review queue.
create or replace function public.admin_list_submissions(p_status public.payment_submission_status default null)
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  owner_email text,
  plan_code text,
  months smallint,
  amount numeric,
  method text,
  sender_number text,
  transaction_id text,
  status public.payment_submission_status,
  created_at timestamptz,
  reviewed_at timestamptz,
  review_note text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_platform_admin() or public.is_service_role()) then
    raise exception 'Platform admin only' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    ps.id, ps.organization_id, o.name, owner.email::text, ps.plan_code, ps.months, ps.amount,
    ps.method, ps.sender_number, ps.transaction_id, ps.status, ps.created_at, ps.reviewed_at, ps.review_note
  from public.payment_submissions ps
  join public.organizations o on o.id = ps.organization_id
  left join lateral (
    select u.email
    from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = ps.organization_id and m.role = 'owner'
    order by m.created_at
    limit 1
  ) owner on true
  where p_status is null or ps.status = p_status
  order by ps.created_at desc
  limit 200;
end;
$$;

grant execute on function public.admin_list_organizations(text) to authenticated;
grant execute on function public.admin_organization_detail(uuid) to authenticated;
grant execute on function public.admin_list_submissions(public.payment_submission_status) to authenticated;
