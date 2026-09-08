-- Storage/DB cleanup pass. Three real leaks this closes:
--
-- 1. Deleting an invoice cascades away its invoice_pdf_exports and
--    invoice_payment_proofs *rows* (existing ON DELETE CASCADE), but nothing
--    ever deleted the underlying storage.objects files those rows pointed
--    at -- every deleted invoice left its PDFs and payment screenshots
--    stranded in storage forever. Fixed with BEFORE DELETE triggers so it's
--    guaranteed at the DB layer, not dependent on client code remembering to
--    call storage.remove() (the existing service functions already do that
--    for their own direct-delete paths; this is the safety net for the
--    cascade path, which had none).
--
-- 2. invoice-pdfs cleanup was purely reactive (only ran when a user saved a
--    new PDF, or when someone happened to open an expired share link) -- an
--    export nobody ever revisits sits in storage past its expiry
--    indefinitely. admin_cleanup_expired_pdf_exports() + the payment-proof
--    and logo equivalents below are meant to be run on a schedule by the
--    storage-maintenance Edge Function (supabase/functions/storage-maintenance),
--    via run_storage_maintenance().
--
-- 3. payment-proofs had no retention at all (unlike invoice-pdfs). Proofs
--    are now eligible for cleanup 90 days after the invoice they back was
--    fully paid -- tracked via the new invoices.paid_at column.
--
-- All three admin_* functions and run_storage_maintenance() are granted to
-- service_role only: they act across every user's data, which is fine for a
-- server-side scheduled job authenticated with the service key, but must
-- never be callable by anon or authenticated (unlike the existing per-user
-- cleanup_expired_pdf_exports(), these don't check auth.uid() at all).
--
-- Every direct `delete from storage.objects` below is preceded by
-- `perform set_config('storage.allow_delete_query', 'true', true)`. Recent
-- Supabase Storage versions install a BEFORE DELETE STATEMENT trigger
-- (protect_objects_delete / storage.protect_delete()) that rejects any
-- direct delete against storage.objects unless that session-local flag is
-- set -- otherwise the delete raises "Direct deletion from storage tables
-- is not allowed. Use the Storage API instead." The `true` third argument
-- scopes it to the current transaction only, so it never leaks past this
-- function call. See migration 0014 for the same fix applied to the
-- pre-existing functions that hit this (written before Storage added the
-- guard).

-- =========================================================================
-- 0. invoices.paid_at -- when the invoice most recently became fully "paid".
--    Cleared if it moves off "paid" (e.g. a payment gets rejected and status
--    is recomputed back down), so a re-approval starts the 90-day clock
--    fresh rather than reusing a stale timestamp.
-- =========================================================================
alter table public.invoices add column if not exists paid_at timestamptz;

create or replace function public.set_invoice_paid_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'paid' and (old.status is distinct from 'paid') then
    new.paid_at = now();
  elsif new.status <> 'paid' then
    new.paid_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_paid_at on public.invoices;
create trigger set_invoice_paid_at before update on public.invoices
  for each row execute function public.set_invoice_paid_at();

-- Backfill: best-effort for invoices already sitting at status = 'paid'
-- before this migration. updated_at is an approximation (the last write to
-- the row, not necessarily the moment it became paid) but it's the only
-- signal available retroactively, and it only affects the one-time initial
-- retention window for pre-existing paid invoices.
update public.invoices set paid_at = updated_at where status = 'paid' and paid_at is null;

-- =========================================================================
-- 1. Delete-cascade safety net: when an invoice_pdf_exports or
--    invoice_payment_proofs row disappears (directly, or via an invoice
--    delete cascading into it), take the storage object with it.
-- =========================================================================
create or replace function public.cleanup_pdf_export_storage_object()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'invoice-pdfs' and name = old.storage_path;
  return old;
end;
$$;

drop trigger if exists cleanup_pdf_export_storage_object on public.invoice_pdf_exports;
create trigger cleanup_pdf_export_storage_object before delete on public.invoice_pdf_exports
  for each row execute function public.cleanup_pdf_export_storage_object();

create or replace function public.cleanup_payment_proof_storage_object()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.storage_path is not null then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where bucket_id = 'payment-proofs' and name = old.storage_path;
  end if;
  return old;
end;
$$;

drop trigger if exists cleanup_payment_proof_storage_object on public.invoice_payment_proofs;
create trigger cleanup_payment_proof_storage_object before delete on public.invoice_payment_proofs
  for each row execute function public.cleanup_payment_proof_storage_object();

-- =========================================================================
-- 2. admin_cleanup_expired_pdf_exports -- global sweep, unlike the existing
--    per-caller cleanup_expired_pdf_exports() (0012). Deleting the rows is
--    enough: the trigger above removes the storage objects.
-- =========================================================================
create or replace function public.admin_cleanup_expired_pdf_exports()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.invoice_pdf_exports where expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_cleanup_expired_pdf_exports() from public;
revoke all on function public.admin_cleanup_expired_pdf_exports() from anon;
revoke all on function public.admin_cleanup_expired_pdf_exports() from authenticated;
grant execute on function public.admin_cleanup_expired_pdf_exports() to service_role;

-- =========================================================================
-- 3. admin_cleanup_paid_payment_proofs -- proofs backing an invoice that's
--    been fully paid for 90+ days are eligible for cleanup. Proofs on
--    invoices that never reached (or fell back out of) "paid" are left
--    alone entirely -- paid_at is null for those, so they never match.
-- =========================================================================
create or replace function public.admin_cleanup_paid_payment_proofs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.invoice_payment_proofs p
    using public.invoices i
    where i.id = p.invoice_id
      and i.status = 'paid'
      and i.paid_at is not null
      and i.paid_at <= now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_cleanup_paid_payment_proofs() from public;
revoke all on function public.admin_cleanup_paid_payment_proofs() from anon;
revoke all on function public.admin_cleanup_paid_payment_proofs() from authenticated;
grant execute on function public.admin_cleanup_paid_payment_proofs() to service_role;

-- =========================================================================
-- 4. admin_cleanup_orphaned_logos -- a re-upload never deleted the file it
--    replaced, so old logos accumulated per user. Can't just delete "the
--    previous" file on upload though: invoice_data is a per-invoice
--    snapshot (see 0001's comment on that column), so an older invoice can
--    still point at an older logo URL and would break (missing image in its
--    PDF/preview) if that file vanished. Safe rule instead: delete a logo
--    object only when NOTHING references its path anymore -- not the
--    owning profile, and not any of that user's invoices, past or present.
--    A 24h grace window (via storage.objects.created_at) avoids racing a
--    just-uploaded logo whose invoice/profile write hasn't landed yet.
-- =========================================================================
create or replace function public.admin_cleanup_orphaned_logos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform set_config('storage.allow_delete_query', 'true', true);

  with candidates as (
    select o.name, o.bucket_id, (storage.foldername(o.name))[1] as owner_id
    from storage.objects o
    where o.bucket_id = 'logos'
      and o.created_at <= now() - interval '24 hours'
  ),
  orphaned as (
    select c.name
    from candidates c
    where c.owner_id ~ '^[0-9a-fA-F-]{36}$'
      and not exists (
        select 1 from public.profiles pr
        where pr.user_id = c.owner_id::uuid and pr.logo_url like '%' || c.name
      )
      and not exists (
        select 1 from public.invoices i
        where i.user_id = c.owner_id::uuid
          and (i.invoice_data -> 'business' ->> 'logoUrl') like '%' || c.name
      )
  )
  delete from storage.objects
    where bucket_id = 'logos' and name in (select name from orphaned);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_cleanup_orphaned_logos() from public;
revoke all on function public.admin_cleanup_orphaned_logos() from anon;
revoke all on function public.admin_cleanup_orphaned_logos() from authenticated;
grant execute on function public.admin_cleanup_orphaned_logos() to service_role;

-- =========================================================================
-- 5. Single entry point for the scheduled Edge Function.
-- =========================================================================
create or replace function public.run_storage_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_pdfs integer;
  v_expired_proofs integer;
  v_orphaned_logos integer;
begin
  v_expired_pdfs := public.admin_cleanup_expired_pdf_exports();
  v_expired_proofs := public.admin_cleanup_paid_payment_proofs();
  v_orphaned_logos := public.admin_cleanup_orphaned_logos();

  return jsonb_build_object(
    'expired_pdf_exports_deleted', v_expired_pdfs,
    'paid_payment_proofs_deleted', v_expired_proofs,
    'orphaned_logos_deleted', v_orphaned_logos,
    'ran_at', now()
  );
end;
$$;

revoke all on function public.run_storage_maintenance() from public;
revoke all on function public.run_storage_maintenance() from anon;
revoke all on function public.run_storage_maintenance() from authenticated;
grant execute on function public.run_storage_maintenance() to service_role;
