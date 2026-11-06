-- ============================================================================
-- is_org_owner() returned null for anyone who is not a member at all.
--
-- It was written as `org_role(org) = 'owner'`, and org_role returns null when
-- there is no membership row. In SQL, `null = 'owner'` is null, and `not null`
-- is null — so a guard written as
--
--     if not public.is_org_owner(org) then raise ...
--
-- never fired for a stranger. It fired correctly for a member with the wrong
-- role, which is why this was easy to miss: the case it let through was the one
-- furthest from the screen.
--
-- Found by asking a second seller to read the first seller's activity log. They
-- could.
--
-- Row level security was never affected: a policy of `using (is_org_owner(...))`
-- drops a row when the expression is null, because null is not true. Only the
-- negated checks inside functions were wrong.
-- ============================================================================

create or replace function public.is_org_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- exists() is false, never null, which is the whole point of this change.
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- Rewritten with the same guard it always meant to have. Left explicit rather
-- than trusting the function above, because this one reads other people's
-- actions and should not depend on a detail elsewhere.
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
  if coalesce(public.is_org_owner(p_organization_id), false) is not true then
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
