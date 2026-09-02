-- Two-step payment verification on top of invoice_payment_proofs:
--   1. An automated OCR check (see src/lib/paymentVerification.ts, run from
--      src/app/api/payment-proofs/[id]/verify/route.ts — no third-party AI
--      API, just local OCR + rule-based matching against the invoice) writes
--      ai_status/ai_notes.
--   2. The invoice owner always still does a manual review (owner_status),
--      regardless of what the script found.
-- high_priority flags a proof for the owner's attention when either step
-- comes back negative, so a busy owner can triage instead of reading every row.
--
-- Also lets the owner record a payment that never went through the client
-- form at all (cash handed over in person, a bank transfer the client didn't
-- bother to log) — recorded_by distinguishes these from client submissions,
-- and storage_path becomes nullable since there's no screenshot for them.

alter table public.invoice_payment_proofs
  alter column storage_path drop not null;

alter table public.invoice_payment_proofs
  add column if not exists recorded_by text not null default 'client'
    check (recorded_by in ('client', 'owner')),
  add column if not exists ai_status text not null default 'pending'
    check (ai_status in ('pending', 'match', 'mismatch', 'error', 'not_applicable')),
  add column if not exists ai_notes text not null default '',
  add column if not exists ai_checked_at timestamptz,
  add column if not exists owner_status text not null default 'pending'
    check (owner_status in ('pending', 'approved', 'rejected')),
  add column if not exists owner_reviewed_at timestamptz;

alter table public.invoice_payment_proofs
  drop column if exists high_priority;

alter table public.invoice_payment_proofs
  add column high_priority boolean generated always as (
    ai_status in ('mismatch', 'error') or owner_status = 'rejected'
  ) stored;

-- Owner can log a payment themselves (cash/other, no client-submitted proof).
-- recorded_by = 'owner' is enforced here so a dashboard-side insert can never
-- masquerade as a client submission.
drop policy if exists "payment_proofs_owner_insert" on public.invoice_payment_proofs;
create policy "payment_proofs_owner_insert" on public.invoice_payment_proofs
  for insert with check (
    recorded_by = 'owner'
    and exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

-- Owner can approve/reject a proof (step 2) and re-trigger the OCR check;
-- the row already belongs to them if they can see it at all (same ownership
-- check as the existing select/delete policies below).
drop policy if exists "payment_proofs_owner_update" on public.invoice_payment_proofs;
create policy "payment_proofs_owner_update" on public.invoice_payment_proofs
  for update using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

-- Return type is changing (text -> uuid of the new row), so drop + recreate
-- rather than CREATE OR REPLACE. The client uses the returned id to kick off
-- the OCR verification step right after upload.
drop function if exists public.submit_payment_proof(text, text, text, text, boolean);

create function public.submit_payment_proof(
  p_token text,
  p_storage_path text,
  p_method text,
  p_note text default '',
  p_partial boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_proof_id uuid;
begin
  select e.invoice_id into v_invoice_id
    from public.invoice_pdf_exports e
    where e.share_token = p_token and e.expires_at > now();

  if v_invoice_id is null then
    raise exception 'This link has expired.';
  end if;

  insert into public.invoice_payment_proofs (invoice_id, storage_path, method, note, recorded_by)
  values (v_invoice_id, p_storage_path, p_method, coalesce(p_note, ''), 'client')
  returning id into v_proof_id;

  update public.invoices
    set status = case when p_partial then 'partially_paid' else 'paid' end
    where id = v_invoice_id;

  return v_proof_id;
end;
$$;

revoke all on function public.submit_payment_proof(text, text, text, text, boolean) from public;
grant execute on function public.submit_payment_proof(text, text, text, text, boolean) to anon, authenticated;
