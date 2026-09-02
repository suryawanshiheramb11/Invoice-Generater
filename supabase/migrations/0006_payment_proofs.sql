-- Lets a client who opens a /share/[token] link record that they paid: pick a
-- method, optionally leave a note, and attach a screenshot/photo of the bank
-- transfer, UPI confirmation, or receipt. Submitting flips the invoice's
-- status so the owner sees it in the dashboard without any manual step.

create table if not exists public.invoice_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  storage_path text not null,
  method text not null default 'other'
    check (method in ('upi', 'bank_transfer', 'cash', 'card', 'other')),
  note text not null default '',
  submitted_at timestamptz not null default now()
);

create index if not exists invoice_payment_proofs_invoice_id_idx on public.invoice_payment_proofs (invoice_id);

alter table public.invoice_payment_proofs enable row level security;

-- No insert/update policy here on purpose: rows are only ever created by
-- submit_payment_proof() below (SECURITY DEFINER), since the person attaching
-- proof is an anonymous client with no auth.uid() to check ownership against.
-- The share token itself (validated inside the function) is what stands in
-- for authorization, same as get_pdf_export_by_token already does for reads.
drop policy if exists "payment_proofs_owner_select" on public.invoice_payment_proofs;
create policy "payment_proofs_owner_select" on public.invoice_payment_proofs
  for select using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

drop policy if exists "payment_proofs_owner_delete" on public.invoice_payment_proofs;
create policy "payment_proofs_owner_delete" on public.invoice_payment_proofs
  for delete using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

-- Private bucket (unlike invoice-pdfs): these screenshots can show bank
-- account numbers and UPI IDs, so files are only ever served to the owner via
-- a short-lived signed URL, never a public one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

-- Anyone can upload here (the uploader is an unauthenticated client), but only
-- into a folder named after a real invoice id — same "the id itself is the
-- secret" model as the rest of this feature; there's no way to enumerate
-- invoice ids from the client, and this doesn't grant read access to anything.
drop policy if exists "payment_proofs_public_insert" on storage.objects;
create policy "payment_proofs_public_insert" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and exists (select 1 from public.invoices i where i.id::text = (storage.foldername(name))[1])
  );

drop policy if exists "payment_proofs_owner_select" on storage.objects;
create policy "payment_proofs_owner_select" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.invoices i
      where i.id::text = (storage.foldername(name))[1] and i.user_id = auth.uid()
    )
  );

drop policy if exists "payment_proofs_owner_delete" on storage.objects;
create policy "payment_proofs_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.invoices i
      where i.id::text = (storage.foldername(name))[1] and i.user_id = auth.uid()
    )
  );

-- get_pdf_export_by_token now also returns invoice_id + status, so the share
-- page can render a payment form (or an "already paid" state) without a
-- second round trip. Return type is changing, so the function must be
-- dropped and recreated rather than CREATE OR REPLACE'd.
drop function if exists public.get_pdf_export_by_token(text);

create function public.get_pdf_export_by_token(p_token text)
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

-- Records a payment proof and marks the invoice paid/partially paid. The
-- share token stands in for the client's authorization (anyone who has the
-- link is treated as the invoice's recipient) — same trust model as viewing
-- the PDF itself. Re-validates expiry so a stale/expired link can't be used
-- to tamper with an invoice's status after the fact.
create or replace function public.submit_payment_proof(
  p_token text,
  p_storage_path text,
  p_method text,
  p_note text default '',
  p_partial boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  select e.invoice_id into v_invoice_id
    from public.invoice_pdf_exports e
    where e.share_token = p_token and e.expires_at > now();

  if v_invoice_id is null then
    raise exception 'This link has expired.';
  end if;

  insert into public.invoice_payment_proofs (invoice_id, storage_path, method, note)
  values (v_invoice_id, p_storage_path, p_method, coalesce(p_note, ''));

  update public.invoices
    set status = case when p_partial then 'partially_paid' else 'paid' end
    where id = v_invoice_id;
end;
$$;

revoke all on function public.submit_payment_proof(text, text, text, text, boolean) from public;
grant execute on function public.submit_payment_proof(text, text, text, text, boolean) to anon, authenticated;
