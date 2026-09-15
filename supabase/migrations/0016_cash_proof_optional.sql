-- Cash has nothing to screenshot. submit_payment_proof (migration 0011) required
-- p_storage_path unconditionally, so a client paying cash could never submit without
-- fabricating a file to attach — the client-side form (PaymentProofForm.tsx) enforced the
-- same requirement for the same reason and is relaxed for "cash" alongside this.
--
-- Every other payment method still requires a real proof at the same path-prefix check as
-- before; only "cash" is allowed a null path.
create or replace function public.submit_payment_proof(
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
  v_total numeric;
  v_status text;
  v_open_claims integer;
begin
  select i.total, i.status into v_total, v_status
    from public.invoices i
    where i.id = p_invoice_id;

  if v_total is null then
    raise exception 'Invoice not found.';
  end if;

  if v_status in ('draft', 'cancelled') then
    raise exception 'This invoice is not accepting payments.';
  end if;

  if p_method is null or p_method not in ('upi', 'bank_transfer', 'cash', 'card', 'other') then
    raise exception 'Unsupported payment method.';
  end if;

  if p_method = 'cash' then
    if p_storage_path is not null
       and p_storage_path !~ ('^' || p_invoice_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$') then
      raise exception 'Invalid proof path.';
    end if;
  else
    if p_storage_path is null
       or p_storage_path !~ ('^' || p_invoice_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$') then
      raise exception 'Invalid proof path.';
    end if;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter how much you are paying.';
  end if;

  -- Rounding slack so a legitimate "pay the exact total" submission can't trip on a
  -- half-paisa float artifact from the browser.
  if p_amount > v_total + 0.01 then
    raise exception 'That is more than the invoice total.';
  end if;

  select count(*) into v_open_claims
    from public.invoice_payment_proofs
    where invoice_id = p_invoice_id
      and recorded_by = 'client'
      and owner_status = 'pending';

  if v_open_claims >= 10 then
    raise exception 'There are already several payment claims awaiting review on this invoice.';
  end if;

  insert into public.invoice_payment_proofs (invoice_id, storage_path, method, note, recorded_by, amount)
  values (p_invoice_id, p_storage_path, p_method, left(coalesce(p_note, ''), 1000), 'client', p_amount)
  returning id into v_proof_id;

  update public.invoices
    set status = case when p_partial then 'partially_paid' else 'paid' end
    where id = p_invoice_id;

  return v_proof_id;
end;
$$;

revoke all on function public.submit_payment_proof(uuid, text, text, text, boolean, numeric) from public;
grant execute on function public.submit_payment_proof(uuid, text, text, text, boolean, numeric) to anon, authenticated;
