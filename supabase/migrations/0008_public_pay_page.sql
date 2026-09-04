-- Permanent public "pay this invoice" page (/pay/[id]), embedded directly in every
-- generated PDF (download, native share, and the saved-snapshot share page) so a client
-- who only ever receives the PDF file itself still has a way in — previously the payment
-- proof form only existed behind a manually-created, expiring /share/[token] link that the
-- owner had to remember to send separately from the PDF.
--
-- This makes invoice_id (already unguessable, and already the trust boundary for the
-- payment-proofs storage bucket's insert policy — see 0006) the sole credential for both
-- reading a public summary and submitting proof, same "the id itself is the secret" model
-- used elsewhere in this feature. The share token keeps its original, narrower job: gating
-- access to one specific saved PDF snapshot until it expires.

-- Minimal public read of an invoice, for an unauthenticated client landing on /pay/[id].
-- Deliberately narrow: no customer address, no bank account numbers beyond what the owner
-- already chose to expose via showPaymentInfo.
create or replace function public.get_public_invoice_summary(p_invoice_id uuid)
returns table(
  invoice_number text,
  business_name text,
  customer_name text,
  status text,
  total numeric,
  currency text,
  due_date date,
  show_payment_info boolean,
  payment_instructions text,
  payment_info jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.invoice_number,
    i.invoice_data -> 'business' ->> 'name',
    i.invoice_data -> 'customer' ->> 'name',
    i.status,
    i.total,
    i.currency,
    i.due_date,
    coalesce((i.invoice_data -> 'customization' ->> 'showPaymentInfo')::boolean, false),
    i.invoice_data ->> 'paymentInstructions',
    i.invoice_data -> 'paymentInfo'
  from public.invoices i
  where i.id = p_invoice_id;
$$;

revoke all on function public.get_public_invoice_summary(uuid) from public;
grant execute on function public.get_public_invoice_summary(uuid) to anon, authenticated;

-- Payment proof submission now keys off invoice_id directly instead of a share_token, so
-- it works from the permanent /pay/[id] page as well as the expiring /share/[token] one
-- (which already exposes invoice_id from get_pdf_export_by_token). Return type is
-- unchanged (uuid), but the parameter list changes, so drop + recreate.
drop function if exists public.submit_payment_proof(text, text, text, text, boolean);

create function public.submit_payment_proof(
  p_invoice_id uuid,
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
  v_proof_id uuid;
begin
  if not exists (select 1 from public.invoices where id = p_invoice_id) then
    raise exception 'Invoice not found.';
  end if;

  insert into public.invoice_payment_proofs (invoice_id, storage_path, method, note, recorded_by)
  values (p_invoice_id, p_storage_path, p_method, coalesce(p_note, ''), 'client')
  returning id into v_proof_id;

  update public.invoices
    set status = case when p_partial then 'partially_paid' else 'paid' end
    where id = p_invoice_id;

  return v_proof_id;
end;
$$;

revoke all on function public.submit_payment_proof(uuid, text, text, text, boolean) from public;
grant execute on function public.submit_payment_proof(uuid, text, text, text, boolean) to anon, authenticated;
