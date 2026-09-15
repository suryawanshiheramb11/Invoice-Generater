-- get_public_invoice_summary told /pay/[id] and /share/[token] the invoice's status and
-- how much of it is *approved*-paid, but nothing about whether a client-submitted proof
-- is already sitting there awaiting the owner's review. Those pages rendered from that
-- alone, so:
--   - PaymentProofForm's "already submitted" UI lived only in React state (`justSubmitted`
--     / `formOpen`), which resets to nothing on a page reload — the customer would see the
--     original pay form again and could submit a second, third, fourth claim for the same
--     payment.
--   - The QR code and bank-details panel stayed visible even after a claim was submitted,
--     since they're keyed off `remaining > 0`, and a *pending* (not yet approved) claim
--     never reduces the remaining balance by design (see get_public_invoice_summary's
--     paid_amount, which only sums owner_status = 'approved' proofs).
--
-- has_pending_claim makes "is there an unreviewed claim right now" a server fact instead
-- of client memory, so the pay pages can render "waiting for approval" and nothing else,
-- and it survives reloads.
create or replace function public.get_public_invoice_summary(p_invoice_id uuid)
returns table(
  invoice_number text,
  business_name text,
  status text,
  total numeric,
  currency text,
  due_date date,
  show_payment_info boolean,
  payment_instructions text,
  payment_info jsonb,
  paid_amount numeric,
  has_pending_claim boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_owner uuid;
begin
  select i.status, i.user_id into v_status, v_owner
    from public.invoices i
    where i.id = p_invoice_id;

  if v_status = 'draft' and (auth.uid() is null or auth.uid() <> v_owner) then
    update public.invoices
      set status = 'sent'
      where id = p_invoice_id and status = 'draft';
  end if;

  return query
    select
      i.invoice_number,
      i.invoice_data -> 'business' ->> 'name',
      i.status,
      i.total,
      i.currency,
      i.due_date,
      coalesce((i.invoice_data -> 'customization' ->> 'showPaymentInfo')::boolean, false),
      case
        when coalesce((i.invoice_data -> 'customization' ->> 'showPaymentInfo')::boolean, false)
        then i.invoice_data ->> 'paymentInstructions'
      end,
      case
        when coalesce((i.invoice_data -> 'customization' ->> 'showPaymentInfo')::boolean, false)
        then i.invoice_data -> 'paymentInfo'
      end,
      coalesce(
        (select sum(p.amount) from public.invoice_payment_proofs p
         where p.invoice_id = i.id and p.owner_status = 'approved'),
        0
      ),
      exists(
        select 1 from public.invoice_payment_proofs p
        where p.invoice_id = i.id and p.recorded_by = 'client' and p.owner_status = 'pending'
      )
    from public.invoices i
    where i.id = p_invoice_id;
end;
$$;

revoke all on function public.get_public_invoice_summary(uuid) from public;
revoke all on function public.get_public_invoice_summary(uuid) from anon;
grant execute on function public.get_public_invoice_summary(uuid) to anon, authenticated;
