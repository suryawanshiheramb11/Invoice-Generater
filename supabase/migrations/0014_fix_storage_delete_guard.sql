-- Recent Supabase Storage versions install a BEFORE DELETE STATEMENT trigger
-- on storage.objects (protect_objects_delete / storage.protect_delete())
-- that rejects any direct `delete from storage.objects` unless the
-- session-local setting `storage.allow_delete_query` is 'true' -- otherwise
-- it raises "Direct deletion from storage tables is not allowed. Use the
-- Storage API instead." (errcode 42501).
--
-- Two functions written before this guard existed do exactly that direct
-- delete and would silently start failing under it:
--   - get_pdf_export_by_token() (0004, reshaped in 0006): self-deletes an
--     expired share link's storage object when a viewer opens it.
--   - cleanup_expired_pdf_exports() (0004, scoped to auth.uid() in 0012):
--     called opportunistically from saveInvoicePdf(); its result is
--     discarded via a no-op .catch() in the client, so a failure here
--     produces no visible symptom -- expired PDFs would simply stop being
--     swept, silently, however long ago Storage started enforcing this.
--
-- Both are recreated below unchanged except for one added line:
-- `perform set_config('storage.allow_delete_query', 'true', true)` before
-- the delete, scoped to the current transaction only (the `true` third
-- argument), so it never leaks past the function call. The three brand-new
-- functions added in 0013 already include this fix from the start.

create or replace function public.get_pdf_export_by_token(p_token text)
returns table(storage_path text, invoice_number text, business_name text, invoice_id uuid, invoice_status text)
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
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where bucket_id = 'invoice-pdfs' and name = v_expired_path;
    delete from public.invoice_pdf_exports where share_token = p_token;
    return;
  end if;

  return query
    select e.storage_path, i.invoice_number, i.invoice_data -> 'business' ->> 'name', i.id, i.status
    from public.invoice_pdf_exports e
    join public.invoices i on i.id = e.invoice_id
    where e.share_token = p_token and e.expires_at > now();
end;
$$;

revoke all on function public.get_pdf_export_by_token(text) from public;
grant execute on function public.get_pdf_export_by_token(text) to anon, authenticated;

create or replace function public.cleanup_expired_pdf_exports()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  perform set_config('storage.allow_delete_query', 'true', true);

  delete from storage.objects
    where bucket_id = 'invoice-pdfs'
      and name in (
        select storage_path from public.invoice_pdf_exports
        where expires_at <= now() and user_id = auth.uid()
      );

  delete from public.invoice_pdf_exports
    where expires_at <= now() and user_id = auth.uid();
end;
$$;

revoke all on function public.cleanup_expired_pdf_exports() from public;
revoke all on function public.cleanup_expired_pdf_exports() from anon;
grant execute on function public.cleanup_expired_pdf_exports() to authenticated;
