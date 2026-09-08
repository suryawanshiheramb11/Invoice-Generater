-- Fixes a bug in 0006's payment_proofs_public_insert storage policy: its with_check
-- did `exists (select 1 from public.invoices where id = ...)` as a plain subquery, which
-- runs under invoices' own RLS (owner-only, auth.uid() = user_id). An anonymous client
-- has no auth.uid(), so that subquery always returned zero rows and every anonymous
-- upload was silently rejected with "You don't have permission to perform this action" —
-- the payment-proof upload flow never actually worked for a real (unauthenticated) client.
--
-- Fix: check existence through a SECURITY DEFINER function instead, so RLS on invoices
-- doesn't block the lookup. This only ever answers true/false for one exact id the caller
-- already has — same "the id itself is the secret" trust model as the rest of this
-- feature, not a way to enumerate or read invoices.

create or replace function public.invoice_exists(p_invoice_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.invoices where id = p_invoice_id);
$$;

revoke all on function public.invoice_exists(uuid) from public;
grant execute on function public.invoice_exists(uuid) to anon, authenticated;

drop policy if exists "payment_proofs_public_insert" on storage.objects;
create policy "payment_proofs_public_insert" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and public.invoice_exists(((storage.foldername(name))[1])::uuid)
  );
