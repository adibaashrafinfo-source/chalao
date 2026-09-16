-- The inventory movement log shows who made each change. Profiles were readable only
-- by their owner, so a teammate's name came back empty. Let people in the same
-- organization read each other's profile — and nobody else's.

create or replace function public.shares_organization(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members them on them.organization_id = me.organization_id
    where me.user_id = auth.uid()
      and them.user_id = p_user_id
  );
$$;

grant execute on function public.shares_organization(uuid) to authenticated;

drop policy if exists "profiles_select_org_members" on public.profiles;

create policy "profiles_select_org_members" on public.profiles
  for select to authenticated
  using (public.shares_organization(id));
