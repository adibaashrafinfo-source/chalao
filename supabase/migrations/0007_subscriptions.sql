-- ============================================================================
-- Subscriptions, phase 1: the data foundation.
--
-- How it works:
--   * Every organization has exactly one subscription row, starting on `free`.
--   * A paid plan carries a period end date. Three days past it is a grace
--     period; after that the organization is expired.
--   * Money is taken by hand (bKash/Nagad). The seller submits a transaction id,
--     a platform admin approves it, and approval extends the period.
--   * Limits are counted per calendar month.
--
-- Nothing is blocked yet — enforcement arrives in a later phase. This migration
-- only records who is on what plan, and what has been paid.
-- ============================================================================

-- Days a seller keeps working after the period ends.
create or replace function public.subscription_grace_days()
returns integer language sql immutable as $$ select 3 $$;

-- ---------------------------------------------------------------- plans

create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  tagline text,
  monthly_price numeric(12, 2) not null default 0 check (monthly_price >= 0),
  -- null means unlimited
  order_limit integer check (order_limit is null or order_limit >= 0),
  user_limit integer check (user_limit is null or user_limit >= 0),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists subscription_plans_set_updated_at on public.subscription_plans;
create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();

-- Seeded with the prices currently shown on the marketing site. They are editable
-- from the admin panel later, which is why they live here and not in the code.
insert into public.subscription_plans (code, name, tagline, monthly_price, order_limit, user_limit, sort_order)
values
  ('free',     'Free',     'For sellers just getting started',   0,    50,   1,  1),
  ('starter',  'Starter',  'For pages with regular orders',      990,  500,  2,  2),
  ('growth',   'Growth',   'For fast-growing businesses',        2490, 2000, 5,  3),
  ('business', 'Business', 'For bigger teams and higher volume', 4990, null, 15, 4)
on conflict (code) do nothing;

-- ---------------------------------------------------------------- subscriptions

-- Only what an admin sets by hand. Grace and expiry are derived from the dates,
-- so nothing has to run on a schedule to keep them correct.
do $$ begin
  create type public.subscription_status as enum ('active', 'suspended');
exception when duplicate_object then null;
end $$;

create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan_code text not null references public.subscription_plans (code),
  status public.subscription_status not null default 'active',
  -- null on the free plan: it never expires
  current_period_start date,
  current_period_end date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organization_subscriptions_set_updated_at on public.organization_subscriptions;
create trigger organization_subscriptions_set_updated_at
  before update on public.organization_subscriptions
  for each row execute function public.set_updated_at();

-- Every existing organization starts on free.
insert into public.organization_subscriptions (organization_id, plan_code)
select id, 'free' from public.organizations
on conflict (organization_id) do nothing;

-- ---------------------------------------------------------------- payments

do $$ begin
  create type public.payment_submission_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

-- What the seller says they sent.
create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_code text not null references public.subscription_plans (code),
  months smallint not null default 1 check (months between 1 and 12),
  amount numeric(12, 2) not null check (amount >= 0),
  method text not null check (method in ('bkash', 'nagad', 'bank', 'cash')),
  sender_number text,
  transaction_id text not null check (length(btrim(transaction_id)) > 0),
  status public.payment_submission_status not null default 'pending',
  submitted_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists payment_submissions_org_idx
  on public.payment_submissions (organization_id, created_at desc);
create index if not exists payment_submissions_pending_idx
  on public.payment_submissions (status, created_at);

-- The same transaction id can't be claimed twice, unless the earlier claim was rejected.
create unique index if not exists payment_submissions_transaction_key
  on public.payment_submissions (lower(btrim(transaction_id)))
  where status <> 'rejected';

-- Money actually accepted. Append-only.
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  submission_id uuid references public.payment_submissions (id) on delete set null,
  plan_code text not null references public.subscription_plans (code),
  months smallint not null check (months between 1 and 12),
  amount numeric(12, 2) not null check (amount >= 0),
  method text not null,
  transaction_id text,
  period_start date not null,
  period_end date not null,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_payments_org_idx
  on public.subscription_payments (organization_id, created_at desc);

drop trigger if exists subscription_payments_no_update on public.subscription_payments;
create trigger subscription_payments_no_update
  before update or delete on public.subscription_payments
  for each row execute function public.forbid_mutation();

-- Every plan change, suspension and approval. Append-only.
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null,
  detail jsonb,
  note text,
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_org_idx
  on public.subscription_events (organization_id, created_at desc);

drop trigger if exists subscription_events_no_update on public.subscription_events;
create trigger subscription_events_no_update
  before update or delete on public.subscription_events
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------- reading state

-- 'active' | 'grace' | 'expired' | 'suspended', worked out from the stored row.
create or replace function public.subscription_state(p_organization_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.organization_subscriptions;
begin
  select * into v_row from public.organization_subscriptions where organization_id = p_organization_id;
  if not found then return 'expired'; end if;
  if v_row.status = 'suspended' then return 'suspended'; end if;
  if v_row.current_period_end is null then return 'active'; end if;
  if current_date <= v_row.current_period_end then return 'active'; end if;
  if current_date <= v_row.current_period_end + public.subscription_grace_days() then return 'grace'; end if;
  return 'expired';
end;
$$;

-- Orders created this calendar month, which is what the plan limit counts.
create or replace function public.subscription_orders_this_month(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.orders
  where organization_id = p_organization_id
    and created_at >= date_trunc('month', now());
$$;

-- One call for everything a billing screen needs.
create or replace function public.subscription_overview(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.organization_subscriptions;
  v_plan public.subscription_plans;
begin
  if not (public.is_org_member(p_organization_id) or public.is_platform_admin() or public.is_service_role()) then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.organization_subscriptions where organization_id = p_organization_id;
  if not found then return null; end if;

  select * into v_plan from public.subscription_plans where code = v_row.plan_code;

  return jsonb_build_object(
    'plan_code', v_row.plan_code,
    'plan_name', v_plan.name,
    'monthly_price', v_plan.monthly_price,
    'order_limit', v_plan.order_limit,
    'user_limit', v_plan.user_limit,
    'status', v_row.status,
    'state', public.subscription_state(p_organization_id),
    'period_start', v_row.current_period_start,
    'period_end', v_row.current_period_end,
    'grace_days', public.subscription_grace_days(),
    'orders_this_month', public.subscription_orders_this_month(p_organization_id)
  );
end;
$$;

-- ---------------------------------------------------------------- changing state

-- Admin: move an organization onto a plan, or suspend / reactivate it.
create or replace function public.admin_set_subscription(
  p_organization_id uuid,
  p_plan_code text default null,
  p_status public.subscription_status default null,
  p_period_end date default null,
  p_note text default null
)
returns public.organization_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.organization_subscriptions;
  v_before public.organization_subscriptions;
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

  update public.organization_subscriptions
    set plan_code = coalesce(p_plan_code, plan_code),
        status = coalesce(p_status, status),
        current_period_end = coalesce(p_period_end, current_period_end),
        current_period_start = case
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

-- Admin: record money received and extend the period. Used directly for cash, and
-- by the approval path for a seller's submission.
create or replace function public.admin_record_payment(
  p_organization_id uuid,
  p_plan_code text,
  p_months smallint,
  p_amount numeric,
  p_method text,
  p_transaction_id text default null,
  p_submission_id uuid default null,
  p_note text default null
)
returns public.subscription_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.organization_subscriptions;
  v_start date;
  v_end date;
  v_payment public.subscription_payments;
begin
  if not (public.is_platform_admin() or public.is_service_role()) then
    raise exception 'Platform admin only' using errcode = 'insufficient_privilege';
  end if;

  if p_months is null or p_months < 1 then
    raise exception 'Months must be at least 1' using errcode = 'check_violation';
  end if;

  select * into v_sub from public.organization_subscriptions
  where organization_id = p_organization_id for update;

  if not found then
    insert into public.organization_subscriptions (organization_id, plan_code)
    values (p_organization_id, p_plan_code)
    returning * into v_sub;
  end if;

  -- Paying early adds to what is left rather than throwing it away.
  v_start := greatest(current_date, coalesce(v_sub.current_period_end, current_date));
  v_end := v_start + (p_months || ' months')::interval;

  update public.organization_subscriptions
    set plan_code = p_plan_code,
        status = 'active',
        current_period_start = coalesce(v_sub.current_period_start, current_date),
        current_period_end = v_end
    where organization_id = p_organization_id;

  insert into public.subscription_payments (
    organization_id, submission_id, plan_code, months, amount, method,
    transaction_id, period_start, period_end, recorded_by
  )
  values (
    p_organization_id, p_submission_id, p_plan_code, p_months, p_amount, p_method,
    nullif(btrim(coalesce(p_transaction_id, '')), ''), v_start, v_end, auth.uid()
  )
  returning * into v_payment;

  insert into public.subscription_events (organization_id, event_type, detail, note, actor)
  values (
    p_organization_id,
    'payment_recorded',
    jsonb_build_object('plan', p_plan_code, 'months', p_months, 'amount', p_amount,
                       'method', p_method, 'period_end', v_end),
    p_note,
    auth.uid()
  );

  return v_payment;
end;
$$;

-- Seller: "I sent the money, here is the transaction id."
create or replace function public.submit_payment(
  p_plan_code text,
  p_months smallint,
  p_amount numeric,
  p_method text,
  p_sender_number text,
  p_transaction_id text
)
returns public.payment_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_submission public.payment_submissions;
begin
  select organization_id into v_org
  from public.organization_members
  where user_id = auth.uid()
  limit 1;

  if v_org is null then
    raise exception 'Not a member of any organization' using errcode = 'insufficient_privilege';
  end if;

  insert into public.payment_submissions (
    organization_id, plan_code, months, amount, method, sender_number, transaction_id, submitted_by
  )
  values (
    v_org, p_plan_code, coalesce(p_months, 1::smallint), p_amount, p_method,
    nullif(btrim(coalesce(p_sender_number, '')), ''), btrim(p_transaction_id), auth.uid()
  )
  returning * into v_submission;

  insert into public.subscription_events (organization_id, event_type, detail, actor)
  values (v_org, 'payment_submitted',
          jsonb_build_object('plan', p_plan_code, 'months', p_months, 'amount', p_amount,
                             'method', p_method, 'transaction_id', p_transaction_id),
          auth.uid());

  return v_submission;
end;
$$;

-- Admin: approve (which extends the period) or reject a submission.
create or replace function public.admin_review_submission(
  p_submission_id uuid,
  p_approve boolean,
  p_note text default null
)
returns public.payment_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.payment_submissions;
begin
  if not (public.is_platform_admin() or public.is_service_role()) then
    raise exception 'Platform admin only' using errcode = 'insufficient_privilege';
  end if;

  select * into v_submission from public.payment_submissions
  where id = p_submission_id for update;

  if not found then
    raise exception 'Submission not found' using errcode = 'no_data_found';
  end if;

  if v_submission.status <> 'pending' then
    raise exception 'This submission was already reviewed' using errcode = 'check_violation';
  end if;

  if p_approve then
    perform public.admin_record_payment(
      v_submission.organization_id, v_submission.plan_code, v_submission.months,
      v_submission.amount, v_submission.method, v_submission.transaction_id,
      v_submission.id, p_note
    );
  end if;

  update public.payment_submissions
    set status = case when p_approve then 'approved' else 'rejected' end::public.payment_submission_status,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = p_note
    where id = p_submission_id
    returning * into v_submission;

  insert into public.subscription_events (organization_id, event_type, detail, note, actor)
  values (v_submission.organization_id,
          case when p_approve then 'payment_approved' else 'payment_rejected' end,
          jsonb_build_object('submission_id', p_submission_id, 'transaction_id', v_submission.transaction_id),
          p_note, auth.uid());

  return v_submission;
end;
$$;

-- New organizations get a free subscription from the start.
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

  insert into public.organization_subscriptions (organization_id, plan_code)
  values (v_org.id, 'free');

  return v_org;
end;
$$;

-- ---------------------------------------------------------------- row level security

alter table public.subscription_plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.subscription_events enable row level security;

-- Plans are public: the pricing section on the marketing site reads them.
drop policy if exists "subscription_plans_select_all" on public.subscription_plans;
create policy "subscription_plans_select_all" on public.subscription_plans
  for select to anon, authenticated using (true);

drop policy if exists "subscription_plans_write_admin" on public.subscription_plans;
create policy "subscription_plans_write_admin" on public.subscription_plans
  for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- A seller sees their own subscription; a platform admin sees everyone's.
-- Neither can write directly — that only happens through the functions above.
drop policy if exists "organization_subscriptions_select" on public.organization_subscriptions;
create policy "organization_subscriptions_select" on public.organization_subscriptions
  for select to authenticated
  using (public.is_org_member(organization_id) or public.is_platform_admin());

drop policy if exists "payment_submissions_select" on public.payment_submissions;
create policy "payment_submissions_select" on public.payment_submissions
  for select to authenticated
  using (public.is_org_member(organization_id) or public.is_platform_admin());

drop policy if exists "subscription_payments_select" on public.subscription_payments;
create policy "subscription_payments_select" on public.subscription_payments
  for select to authenticated
  using (public.is_org_member(organization_id) or public.is_platform_admin());

drop policy if exists "subscription_events_select" on public.subscription_events;
create policy "subscription_events_select" on public.subscription_events
  for select to authenticated
  using (public.is_org_member(organization_id) or public.is_platform_admin());

-- ---------------------------------------------------------------- grants

grant execute on function public.subscription_grace_days() to anon, authenticated;
grant execute on function public.subscription_state(uuid) to authenticated;
grant execute on function public.subscription_orders_this_month(uuid) to authenticated;
grant execute on function public.subscription_overview(uuid) to authenticated;
grant execute on function public.submit_payment(text, smallint, numeric, text, text, text) to authenticated;
grant execute on function public.admin_set_subscription(uuid, text, public.subscription_status, date, text) to authenticated;
grant execute on function public.admin_record_payment(uuid, text, smallint, numeric, text, text, uuid, text) to authenticated;
grant execute on function public.admin_review_submission(uuid, boolean, text) to authenticated;
