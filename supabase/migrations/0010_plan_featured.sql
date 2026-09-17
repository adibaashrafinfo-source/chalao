-- Which plan carries the "Most Popular" badge on the marketing site used to be decided
-- in the code. Move it next to the prices so it can be changed from the admin panel.

alter table public.subscription_plans
  add column if not exists is_featured boolean not null default false;

update public.subscription_plans set is_featured = true where code = 'growth';

-- Only one plan may wear the badge.
create unique index if not exists subscription_plans_single_featured
  on public.subscription_plans ((is_featured))
  where is_featured;
