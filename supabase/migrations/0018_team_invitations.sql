-- ============================================================================
-- Team: invitations, and the plan's user limit.
--
-- Plans are sold as "2 users", "5 users", "15 users", but until now there was no
-- way to add a second person at all, and nothing counted them.
--
-- Invitations are links, not emails. The owner shares the link however they
-- already talk to their staff — WhatsApp, Messenger — and the person opens it
-- signed in with the email address it was made for. A link that leaks is useless
-- to anyone signed in with a different address.
-- ============================================================================

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  -- Nobody is invited in as an owner. Ownership is not handed out by link.
  role public.member_role not null check (role in ('manager', 'staff')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organization_invitations_org_idx
  on public.organization_invitations (organization_id, created_at desc);

-- One open invitation per address per organization; a second click resends the same one.
create unique index if not exists organization_invitations_open_key
  on public.organization_invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------- the user limit

-- Checked on every new membership, whichever way it arrives, so the limit on the
-- pricing page is a fact rather than a promise.
create or replace function public.enforce_user_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select p.user_limit into v_limit
  from public.organization_subscriptions s
  join public.subscription_plans p on p.code = s.plan_code
  where s.organization_id = new.organization_id;

  -- No subscription row yet is the moment the organization is being created.
  if v_limit is null then return new; end if;

  select count(*) into v_count
  from public.organization_members
  where organization_id = new.organization_id;

  if v_count >= v_limit then
    raise exception 'USER_LIMIT_REACHED: this plan allows % users', v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists organization_members_user_limit on public.organization_members;
create trigger organization_members_user_limit
  before insert on public.organization_members
  for each row execute function public.enforce_user_limit();

-- The owner stays the owner: nobody is promoted to it, demoted from it, or
-- removed while holding it through the ordinary team screen.
create or replace function public.protect_owner_membership()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      raise exception 'The owner cannot be removed from the team' using errcode = 'restrict_violation';
    end if;
    return old;
  end if;

  if old.role = 'owner' and new.role <> 'owner' then
    raise exception 'The owner cannot be given another role' using errcode = 'restrict_violation';
  end if;
  if old.role <> 'owner' and new.role = 'owner' then
    raise exception 'Ownership cannot be given away from the team screen' using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists organization_members_protect_owner on public.organization_members;
create trigger organization_members_protect_owner
  before update or delete on public.organization_members
  for each row execute function public.protect_owner_membership();

-- ---------------------------------------------------------------- reading the team

-- Names and email addresses for the team screen. Emails live in auth.users, which
-- the dashboard cannot read directly, so this hands out exactly those two fields
-- and only to members of the same organization.
create or replace function public.organization_team(p_organization_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  role public.member_role,
  full_name text,
  email text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  return query
  select m.id, m.user_id, m.role, p.full_name, u.email::text, m.created_at
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.organization_id = p_organization_id
  order by case m.role when 'owner' then 0 when 'manager' then 1 else 2 end, m.created_at;
end;
$$;

grant execute on function public.organization_team(uuid) to authenticated;

-- ---------------------------------------------------------------- accepting

-- What the invite page shows before anything is decided. The token is the
-- secret; whoever holds it may learn which business invited which address.
create or replace function public.invitation_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite public.organization_invitations;
  v_name text;
begin
  select * into v_invite from public.organization_invitations where token = p_token;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  select name into v_name from public.organizations where id = v_invite.organization_id;

  return jsonb_build_object(
    'status', case
      when v_invite.revoked_at is not null then 'revoked'
      when v_invite.accepted_at is not null then 'accepted'
      when v_invite.expires_at < now() then 'expired'
      else 'open'
    end,
    'organization_name', v_name,
    'email', v_invite.email,
    'role', v_invite.role
  );
end;
$$;

grant execute on function public.invitation_preview(text) to anon, authenticated;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.organization_invitations;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.organization_invitations where token = p_token for update;
  if not found then
    raise exception 'INVITE_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'INVITE_REVOKED' using errcode = 'check_violation';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'INVITE_USED' using errcode = 'check_violation';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'check_violation';
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is distinct from v_invite.email then
    raise exception 'INVITE_WRONG_EMAIL' using errcode = 'insufficient_privilege';
  end if;

  -- The dashboard works with one organization per person.
  if exists (select 1 from public.organization_members where user_id = auth.uid()) then
    raise exception 'INVITE_ALREADY_MEMBER' using errcode = 'unique_violation';
  end if;

  -- The user limit trigger has the final say here.
  insert into public.organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, auth.uid(), v_invite.role);

  update public.organization_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_invite.id;

  return v_invite.organization_id;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.organization_invitations enable row level security;

-- Only the owner sees and manages invitations. Revoking is an update, so there is
-- no delete: what was offered, and to whom, stays on record.
drop policy if exists "organization_invitations_select_owner" on public.organization_invitations;
create policy "organization_invitations_select_owner" on public.organization_invitations
  for select to authenticated using (public.is_org_owner(organization_id));
drop policy if exists "organization_invitations_insert_owner" on public.organization_invitations;
create policy "organization_invitations_insert_owner" on public.organization_invitations
  for insert to authenticated with check (public.is_org_owner(organization_id));
drop policy if exists "organization_invitations_update_owner" on public.organization_invitations;
create policy "organization_invitations_update_owner" on public.organization_invitations
  for update to authenticated using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
