-- Tracks how much was actually paid per proof, so a remaining balance can be computed
-- after a partial payment. Previously there was no amount column at all — "partial
-- payment" was just a boolean with no number behind it, so nothing could show how much
-- was still owed.

alter table public.invoice_payment_proofs
  add column if not exists amount numeric(14, 2);

-- submit_payment_proof gains p_amount (nullable — a pre-existing caller omitting it just
-- leaves the new proof's amount unset, same as legacy rows).
drop function if exists public.submit_payment_proof(uuid, text, text, text, boolean);

create function public.submit_payment_proof(
  p_invoice_id uuid,
  p_storage_path text,
  p_method text,
  p_note text default '',
  p_partial boolean default false,
  p_amount numeric default null
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

  insert into public.invoice_payment_proofs (invoice_id, storage_path, method, note, recorded_by, amount)
  values (p_invoice_id, p_storage_path, p_method, coalesce(p_note, ''), 'client', p_amount)
  returning id into v_proof_id;

  update public.invoices
    set status = case when p_partial then 'partially_paid' else 'paid' end
    where id = p_invoice_id;

  return v_proof_id;
end;
$$;

revoke all on function public.submit_payment_proof(uuid, text, text, text, boolean, numeric) from public;
grant execute on function public.submit_payment_proof(uuid, text, text, text, boolean, numeric) to anon, authenticated;

-- get_public_invoice_summary now also returns paid_amount — the sum of amounts from
-- *approved* proofs only (a client's own pending claim shouldn't reduce the balance shown
-- until the owner has confirmed it). The /pay/[id] page derives the remaining balance from
-- this plus status (a "paid" invoice is always fully settled by definition, regardless of
-- whether older rows have an amount recorded).
drop function if exists public.get_public_invoice_summary(uuid);

create function public.get_public_invoice_summary(p_invoice_id uuid)
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
  payment_info jsonb,
  paid_amount numeric
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
    i.invoice_data -> 'paymentInfo',
    coalesce(
      (select sum(p.amount) from public.invoice_payment_proofs p
       where p.invoice_id = i.id and p.owner_status = 'approved'),
      0
    )
  from public.invoices i
  where i.id = p_invoice_id;
$$;

revoke all on function public.get_public_invoice_summary(uuid) from public;
grant execute on function public.get_public_invoice_summary(uuid) to anon, authenticated;
