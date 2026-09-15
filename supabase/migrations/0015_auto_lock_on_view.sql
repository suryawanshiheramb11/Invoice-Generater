-- Locks an invoice the moment its actual recipient opens the payment page, instead of
-- relying on the owner to remember to change a status dropdown, or on a proxy action
-- (downloading/sharing the PDF) that the owner might do repeatedly while still drafting.
--
-- get_public_invoice_summary is the one RPC both /pay/[id] and /share/[token] call on
-- every page load (see PayInvoicePage and SharedInvoicePage) to read the amount due, so
-- it's the single true "someone is looking at this invoice" signal. A draft invoice was
-- never payable anyway (submit_payment_proof, migration 0011) — this just makes the
-- status catch up with that the first time anyone other than the owner sees it, which is
-- also what flips `locked` in the editor (InvoiceEditor.tsx) and stops further edits.
--
-- The owner previewing their own /pay/[id] link while signed in must NOT trigger this —
-- otherwise clicking your own payment link to see what it looks like would silently lock
-- the invoice out from under you. Guarded by comparing auth.uid() to the invoice's
-- user_id; every other caller (anonymous, or signed in as someone else) counts as the
-- recipient.
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
  paid_amount numeric
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
      )
    from public.invoices i
    where i.id = p_invoice_id;
end;
$$;

revoke all on function public.get_public_invoice_summary(uuid) from public;
revoke all on function public.get_public_invoice_summary(uuid) from anon;
grant execute on function public.get_public_invoice_summary(uuid) to anon, authenticated;
