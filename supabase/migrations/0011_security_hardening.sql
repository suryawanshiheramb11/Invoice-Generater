-- Security hardening of the anonymous-facing surface (the /pay/[id] and /share/[token]
-- pages, and the storage bucket behind them). Everything here closes a gap where the
-- *only* thing standing between an anonymous caller and someone else's data was
-- client-side JavaScript — which is not a control at all, since these RPCs are callable
-- directly with the publishable anon key that ships in every browser bundle.

-- =========================================================================
-- 1. get_public_invoice_summary must honour showPaymentInfo
--
-- It returned invoice_data -> 'paymentInfo' unconditionally: bank account number, IFSC,
-- SWIFT, UPI id and PayPal address handed to anyone holding an invoice id, even when the
-- owner had explicitly switched "show payment info" off. The page only *rendered* it
-- conditionally, which does nothing for someone reading the RPC response directly.
-- customer_name is dropped entirely — nothing consumes it, and it is the one piece of
-- third-party PII this function was exposing.
-- =========================================================================
drop function if exists public.get_public_invoice_summary(uuid);

create function public.get_public_invoice_summary(p_invoice_id uuid)
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
language sql
security definer
set search_path = public
stable
as $$
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
$$;

revoke all on function public.get_public_invoice_summary(uuid) from public;
revoke all on function public.get_public_invoice_summary(uuid) from anon;
grant execute on function public.get_public_invoice_summary(uuid) to anon, authenticated;

-- =========================================================================
-- 2. submit_payment_proof: validate everything the caller controls
--
-- Every argument here comes from an unauthenticated browser. Previously the only checks
-- were "does this invoice exist" plus whatever the client-side JS chose to enforce, so a
-- direct RPC call could:
--   * point p_storage_path at ANY object in the private payment-proofs bucket. The OCR
--     verifier downloads that path with the service-role key (bypassing storage RLS) and
--     writes the extracted text into ai_notes — a row the submitter can read back if the
--     proof hangs off an invoice they own. That is a cross-tenant read of someone else's
--     payment screenshot; the path prefix check below is what closes it.
--   * record a negative or wildly oversized amount, corrupting the balance arithmetic
--     (remaining = total - sum(approved)) once approved.
--   * insert unbounded rows, flooding the owner's dashboard and the storage bucket.
-- =========================================================================
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

  -- A draft was never sent to anyone, and a cancelled invoice is closed. Neither should
  -- be flippable to "paid" by someone replaying an old link.
  if v_status in ('draft', 'cancelled') then
    raise exception 'This invoice is not accepting payments.';
  end if;

  -- The proof must live in this invoice's own folder. The character class also rejects
  -- path traversal and nested paths, which matter because the filename extension is
  -- derived from the uploader's own file name.
  if p_storage_path is null
     or p_storage_path !~ ('^' || p_invoice_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$') then
    raise exception 'Invalid proof path.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter how much you are paying.';
  end if;

  -- Rounding slack so a legitimate "pay the exact total" submission can't trip on a
  -- half-paisa float artifact from the browser.
  if p_amount > v_total + 0.01 then
    raise exception 'That is more than the invoice total.';
  end if;

  if p_method is null or p_method not in ('upi', 'bank_transfer', 'cash', 'card', 'other') then
    raise exception 'Unsupported payment method.';
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

-- =========================================================================
-- 3. Cap how many files one invoice can accumulate in the private bucket
--
-- The insert policy from 0009 let anyone holding an invoice id upload without limit
-- (10MB each). The count runs inside a SECURITY DEFINER function so it isn't re-filtered
-- by storage.objects' own RLS, and so a malformed (non-uuid) folder returns false
-- instead of raising a cast error out of the policy.
-- =========================================================================
create or replace function public.payment_proof_upload_allowed(p_folder text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_invoice_id uuid;
  v_count integer;
begin
  begin
    v_invoice_id := p_folder::uuid;
  exception when others then
    return false;
  end;

  if not exists (select 1 from public.invoices where id = v_invoice_id) then
    return false;
  end if;

  select count(*) into v_count
    from storage.objects o
    where o.bucket_id = 'payment-proofs'
      and o.name like v_invoice_id::text || '/%';

  return v_count < 25;
end;
$$;

revoke all on function public.payment_proof_upload_allowed(text) from public;
grant execute on function public.payment_proof_upload_allowed(text) to anon, authenticated;

drop policy if exists "payment_proofs_public_insert" on storage.objects;
create policy "payment_proofs_public_insert" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and public.payment_proof_upload_allowed((storage.foldername(name))[1])
  );

-- =========================================================================
-- 4. Stop accepting SVG logos
--
-- The logos bucket is public, so an uploaded .svg is served verbatim from the Supabase
-- origin — and SVG is an active content type (it can carry <script>). It renders through
-- <img> everywhere in this app, where scripts never execute, so nothing legitimate needs
-- it; the only thing the format buys here is a stored-XSS payload host.
-- =========================================================================
update storage.buckets
  set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
  where id = 'logos';
