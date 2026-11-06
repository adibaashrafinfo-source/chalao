-- ============================================================================
-- Who did what, and which language they read in.
--
-- Two unrelated things, both of which only started to matter once a business
-- could have more than one person in it.
--
-- The ledgers already record the facts that move money or stock: order status
-- history, inventory movements, payouts, subscription events. What nothing
-- recorded was the quiet decisions — a product deleted, a rule changed, a role
-- given. Those are exactly the ones an owner asks about later.
-- ============================================================================

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor uuid references auth.users (id) on delete set null,
  -- A dotted code, said in the seller's own words by the screen: product.delete
  action text not null,
  entity text,
  entity_id uuid,
  -- Enough to recognise the thing afterwards, since the row itself may be gone.
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_idx
  on public.audit_events (organization_id, created_at desc);

-- A log that can be edited is not a log.
drop trigger if exists audit_events_no_change on public.audit_events;
create trigger audit_events_no_change
  before update or delete on public.audit_events
  for each row execute function public.forbid_mutation();

create or replace function public.record_audit(
  p_action text,
  p_entity text default null,
  p_entity_id uuid default null,
  p_detail jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if auth.uid() is null then return; end if;

  -- The organization is the caller's own; it is never passed in.
  select organization_id into v_organization_id
  from public.organization_members
  where user_id = auth.uid()
  limit 1;

  if v_organization_id is null then return; end if;

  insert into public.audit_events (organization_id, actor, action, entity, entity_id, detail)
  values (v_organization_id, auth.uid(), p_action, p_entity, p_entity_id, p_detail);
end;
$$;

grant execute on function public.record_audit(text, text, uuid, jsonb) to authenticated;

-- Reading it back with names, since emails live in auth.users.
create or replace function public.audit_trail(p_organization_id uuid, p_limit integer default 100)
returns table (
  id uuid,
  action text,
  entity text,
  entity_id uuid,
  detail jsonb,
  actor_name text,
  actor_email text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- The whole point is accountability, so only the owner reads it.
  if not public.is_org_owner(p_organization_id) then
    raise exception 'Only the owner can read the activity log' using errcode = 'insufficient_privilege';
  end if;

  return query
  select a.id, a.action, a.entity, a.entity_id, a.detail,
         p.full_name, u.email::text, a.created_at
  from public.audit_events a
  left join auth.users u on u.id = a.actor
  left join public.profiles p on p.id = a.actor
  where a.organization_id = p_organization_id
  order by a.created_at desc
  limit least(coalesce(p_limit, 100), 500);
end;
$$;

grant execute on function public.audit_trail(uuid, integer) to authenticated;

alter table public.audit_events enable row level security;

-- No policies on purpose: written by record_audit(), read through audit_trail().

-- ---------------------------------------------------------------- language

-- Which language this person reads the dashboard in. Per person rather than per
-- business: an owner may work in English while their staff read Bangla.
alter table public.profiles
  add column if not exists language text not null default 'en'
  check (language in ('en', 'bn'));
