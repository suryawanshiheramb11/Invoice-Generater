-- Re-creates the "logos" storage bucket and its owner-only write policies.
-- Safe to run even if some/all of this already exists (idempotent), which is
-- why it's a separate migration rather than assuming 0001_init.sql's storage
-- section actually landed in the live database.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

drop policy if exists "logos_owner_insert" on storage.objects;
create policy "logos_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "logos_owner_update" on storage.objects;
create policy "logos_owner_update" on storage.objects
  for update using (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "logos_owner_delete" on storage.objects;
create policy "logos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );
