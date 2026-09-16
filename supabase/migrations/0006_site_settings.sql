-- Settings for the public marketing site (social links in the footer).
--
-- These belong to F-Commerce OS itself, not to any seller's organization, so they live
-- in a single row that anyone may read and only a platform admin may change.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  facebook_url text,
  instagram_url text,
  youtube_url text,
  tiktok_url text,
  linkedin_url text,
  whatsapp_url text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

grant execute on function public.is_platform_admin() to authenticated;

alter table public.platform_admins enable row level security;
alter table public.site_settings enable row level security;

-- You can only see your own admin row — enough for the UI to show or hide the page.
drop policy if exists "platform_admins_select_own" on public.platform_admins;
create policy "platform_admins_select_own" on public.platform_admins
  for select to authenticated using (user_id = auth.uid());

-- The footer is public, so visitors must be able to read the links.
drop policy if exists "site_settings_select_all" on public.site_settings;
create policy "site_settings_select_all" on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists "site_settings_update_admin" on public.site_settings;
create policy "site_settings_update_admin" on public.site_settings
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- MAKE YOURSELF THE PLATFORM ADMIN
-- Replace the address with the email you sign in to F-Commerce OS with, then run
-- this line. Without it nobody can edit the social links.
-- ---------------------------------------------------------------------------
-- insert into public.platform_admins (user_id)
-- select id from auth.users where email = 'you@example.com'
-- on conflict (user_id) do nothing;
