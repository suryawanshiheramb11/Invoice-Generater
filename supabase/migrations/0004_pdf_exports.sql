-- Saved PDF snapshots: one row per "Save PDF" action, doubling as both the
-- user's personal export history and a public shareable link (gated by an
-- unguessable token + expiry, not by bucket privacy).

create table if not exists public.invoice_pdf_exports (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists invoice_pdf_exports_invoice_id_idx on public.invoice_pdf_exports (invoice_id);

alter table public.invoice_pdf_exports enable row level security;

drop policy if exists "pdf_exports_owner_select" on public.invoice_pdf_exports;
create policy "pdf_exports_owner_select" on public.invoice_pdf_exports
  for select using (user_id = auth.uid());

drop policy if exists "pdf_exports_owner_insert" on public.invoice_pdf_exports;
create policy "pdf_exports_owner_insert" on public.invoice_pdf_exports
  for insert with check (user_id = auth.uid());

drop policy if exists "pdf_exports_owner_delete" on public.invoice_pdf_exports;
create policy "pdf_exports_owner_delete" on public.invoice_pdf_exports
  for delete using (user_id = auth.uid());

-- Public bucket: the PDF bytes themselves aren't sensitive (an invoice a user
-- chose to share), and access to *arbitrary* files is still gated by needing
-- the unguessable {user_id}/{share_token}.pdf path. The real expiry gate is
-- get_pdf_export_by_token() below, used by the /share/[token] page instead of
-- linking directly to the storage URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoice-pdfs', 'invoice-pdfs', true, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf'];

-- Required for owner-initiated deletes: Storage's bulk-delete (remove()) resolves
-- the given path/prefix to an object id via a SELECT before deleting it, so a
-- DELETE policy alone silently matches nothing without this.
drop policy if exists "invoice_pdfs_owner_select" on storage.objects;
create policy "invoice_pdfs_owner_select" on storage.objects
  for select using (
    bucket_id = 'invoice-pdfs' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "invoice_pdfs_owner_insert" on storage.objects;
create policy "invoice_pdfs_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'invoice-pdfs' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "invoice_pdfs_owner_delete" on storage.objects;
create policy "invoice_pdfs_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'invoice-pdfs' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Looks up a share link for a viewer who isn't signed in. SECURITY DEFINER so it
-- can bypass RLS on invoice_pdf_exports (a plain SELECT policy would either hide
-- everything from anon viewers or require exposing the whole table). Expired
-- links are deleted (row + storage object) on the read that discovers them,
-- which is the only cleanup this feature needs — no cron required at this scale.
create or replace function public.get_pdf_export_by_token(p_token text)
returns table(storage_path text, invoice_number text, business_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_path text;
begin
  select e.storage_path into v_expired_path
    from public.invoice_pdf_exports e
    where e.share_token = p_token and e.expires_at <= now();

  if v_expired_path is not null then
    delete from storage.objects where bucket_id = 'invoice-pdfs' and name = v_expired_path;
    delete from public.invoice_pdf_exports where share_token = p_token;
    return;
  end if;

  return query
    select e.storage_path, i.invoice_number, i.invoice_data -> 'business' ->> 'name'
    from public.invoice_pdf_exports e
    join public.invoices i on i.id = e.invoice_id
    where e.share_token = p_token and e.expires_at > now();
end;
$$;

revoke all on function public.get_pdf_export_by_token(text) from public;
grant execute on function public.get_pdf_export_by_token(text) to anon, authenticated;

-- Opportunistic sweep so storage doesn't accumulate PDFs nobody ever re-visits
-- via their share link. Called before creating a new export (see saveInvoicePdf).
create or replace function public.cleanup_expired_pdf_exports()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from storage.objects
    where bucket_id = 'invoice-pdfs'
      and name in (select storage_path from public.invoice_pdf_exports where expires_at <= now());
  delete from public.invoice_pdf_exports where expires_at <= now();
end;
$$;

revoke all on function public.cleanup_expired_pdf_exports() from public;
grant execute on function public.cleanup_expired_pdf_exports() to authenticated;
