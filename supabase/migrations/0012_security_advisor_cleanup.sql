-- Response to Supabase's Security Advisor "SECURITY DEFINER" warnings.
--
-- Most of these warnings are inherent to this app's design, not a gap: get_public_invoice_
-- summary, get_pdf_export_by_token, submit_payment_proof, and invoice_exists are the RPCs
-- behind /pay/[id] and /share/[token] — public pages a client pays through without ever
-- signing in. `anon` execute access on them isn't a misconfiguration, it's the point; each
-- one is already scoped to reveal or accept only the minimum for that one exact id/token
-- (see migrations 0004, 0008, 0009, 0011). Revoking anon there would break payment
-- collection, so those warnings are expected to stay and are documented in place below.
--
-- cleanup_expired_pdf_exports is the one warning here that reflects a real, fixable gap:
-- it's callable by any signed-in user and, as written, deleted expired export rows
-- globally rather than scoping to the caller. Nothing sensitive was exposed by that (it
-- only ever touched rows that were already expired, never another user's live data), but
-- there's no reason any authenticated account should be able to trigger a table-wide
-- sweep. Scoped to auth.uid() now, the same pattern next_invoice_number already uses.

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

comment on function public.get_public_invoice_summary(uuid) is
  'Intentionally anon + authenticated: backs the public /pay/[id] page a client opens without '
  'signing in. Scoped to one exact invoice id (unguessable, already the trust boundary for '
  'payment-proof uploads); bank/UPI details are only returned when the owner turned '
  'showPaymentInfo on (see migration 0011). Accepted, not a gap — do not revoke anon.';

comment on function public.get_pdf_export_by_token(text) is
  'Intentionally anon + authenticated: backs the public /share/[token] page. Scoped to one '
  'exact, unguessable share_token that self-expires; exposes no other rows. Accepted, not '
  'a gap — do not revoke anon.';

comment on function public.submit_payment_proof(uuid, text, text, text, boolean, numeric) is
  'Intentionally anon + authenticated: the only way an unauthenticated client can record a '
  'payment claim from /pay/[id] or /share/[token]. Every argument is validated server-side '
  '(amount bounds, storage path prefix, method allowlist, per-invoice claim cap) — see '
  'migration 0011. Accepted, not a gap — do not revoke anon.';

comment on function public.invoice_exists(uuid) is
  'Intentionally anon + authenticated: lets the payment-proofs storage insert policy check '
  'an invoice id exists without being re-filtered by invoices'' own owner-only RLS. Returns '
  'only a boolean for one exact id — no enumeration or data exposure. Accepted, not a gap.';
