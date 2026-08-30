-- Security hardening in response to Supabase's Security Advisor warnings:
--   1. Function Search Path Mutable (public.set_updated_at)
--   2. Public Bucket Allows Listing (storage.logos)
--   3/4. next_invoice_number callable by public/anon and flagged as a callable
--        SECURITY DEFINER function (fixed by removing the need for SECURITY
--        DEFINER entirely, not just tightening its grants)
--   (Leaked Password Protection is a Supabase Auth setting gated behind the Pro
--    plan — it cannot be enabled on the Free plan regardless of dashboard toggle
--    or SQL; enable it under Authentication -> Attack Protection after upgrading.)

-- 1. Pin search_path on the updated_at trigger function so it can't be hijacked
-- by a role that creates objects earlier in an attacker-controlled search path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Drop the overly broad public SELECT policy on storage.objects for the logos
-- bucket. The bucket's own `public = true` flag already serves files via the
-- public URL endpoint (bypassing RLS) — this policy only ever added the ability
-- to list/enumerate every uploaded file through the Storage API, which the app
-- never needs and nobody should be able to do.
drop policy if exists "logos_public_read" on storage.objects;

-- 3/4. next_invoice_number no longer needs SECURITY DEFINER at all. It only ever
-- inserts/updates the *calling user's own* profiles row (p_user_id is checked
-- against auth.uid() below), and the existing profiles RLS policies
-- (profiles_insert_own / profiles_update_own) already permit exactly that for
-- the row's owner. Running it as SECURITY INVOKER (the default) means it's
-- fully subject to RLS like any normal query — there is no elevated-privilege
-- surface left to lock down, which removes the "callable SECURITY DEFINER
-- function" warning entirely rather than just tightening its grants.
create or replace function public.next_invoice_number(p_user_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_seq integer;
  v_year text := to_char(current_date, 'YYYY');
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  insert into public.profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.profiles
  set invoice_sequence = invoice_sequence + 1,
      updated_at = now()
  where user_id = p_user_id
  returning invoice_sequence into v_seq;

  return 'INV-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Still revoke from anon/public and grant only to authenticated as defense in
-- depth, even though RLS alone would already block anon (auth.uid() is null).
revoke all on function public.next_invoice_number(uuid) from public;
revoke all on function public.next_invoice_number(uuid) from anon;
grant execute on function public.next_invoice_number(uuid) to authenticated;
