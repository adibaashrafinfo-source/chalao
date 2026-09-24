-- ============================================================================
-- The seller's own logo, for the invoice that goes inside the parcel.
--
-- Until now that invoice carried Chalao's logo. A customer opening a parcel
-- should see the shop they bought from, not the software the shop happens to
-- use. Free advertising is not worth looking like someone else's leaflet.
--
-- Logos are public: they are printed on paper that goes out to customers.
-- Writing them is not — each business can only write inside its own folder.
-- ============================================================================

alter table public.organizations
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', true)
on conflict (id) do nothing;

-- The first folder of the path is the organization id, which is what ties an
-- uploaded file to the business allowed to replace it.
drop policy if exists "business_logos_read" on storage.objects;
create policy "business_logos_read" on storage.objects
  for select to public
  using (bucket_id = 'business-logos');

drop policy if exists "business_logos_insert" on storage.objects;
create policy "business_logos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-logos'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "business_logos_update" on storage.objects;
create policy "business_logos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-logos'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'business-logos'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "business_logos_delete" on storage.objects;
create policy "business_logos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-logos'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
