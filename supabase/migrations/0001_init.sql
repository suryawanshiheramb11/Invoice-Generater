-- Invoice Generator: initial schema, RLS policies, and storage setup.
-- Run via `supabase db push` or the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- =========================================================================
-- profiles: one row per authenticated user, holds saved business info
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  business_name text not null default '',
  logo_url text,
  address_line text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default '',
  postal_code text not null default '',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  tax_number text not null default '',
  registration_number text not null default '',
  invoice_sequence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- customers
-- =========================================================================
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  address_line text not null default '',
  city text not null default '',
  state text not null default '',
  country text not null default '',
  postal_code text not null default '',
  tax_id text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_user_id_idx on public.customers (user_id);

alter table public.customers enable row level security;

create policy "customers_select_own" on public.customers
  for select using (auth.uid() = user_id);
create policy "customers_insert_own" on public.customers
  for insert with check (auth.uid() = user_id);
create policy "customers_update_own" on public.customers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "customers_delete_own" on public.customers
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- invoices
-- =========================================================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_number text not null,
  customer_id uuid references public.customers (id) on delete set null,
  invoice_date date not null default current_date,
  due_date date not null default current_date,
  currency text not null default 'INR',
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled')),
  subtotal numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  tax numeric(14, 2) not null default 0,
  shipping numeric(14, 2) not null default 0,
  other_charges numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  template text not null default 'modern',
  invoice_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, invoice_number)
);

create index if not exists invoices_user_id_idx on public.invoices (user_id);
create index if not exists invoices_status_idx on public.invoices (user_id, status);
create index if not exists invoices_invoice_date_idx on public.invoices (user_id, invoice_date desc);

alter table public.invoices enable row level security;

create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = user_id);
create policy "invoices_insert_own" on public.invoices
  for insert with check (auth.uid() = user_id);
create policy "invoices_update_own" on public.invoices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invoices_delete_own" on public.invoices
  for delete using (auth.uid() = user_id);

-- =========================================================================
-- invoice_items (relational line items, kept alongside invoice_data jsonb
-- so the full editor state round-trips exactly while still allowing SQL
-- reporting/analytics over individual line items)
-- =========================================================================
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null default '',
  quantity numeric(14, 3) not null default 1,
  rate numeric(14, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  amount numeric(14, 2) not null default 0
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

alter table public.invoice_items enable row level security;

create policy "invoice_items_select_own" on public.invoice_items
  for select using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );
create policy "invoice_items_insert_own" on public.invoice_items
  for insert with check (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );
create policy "invoice_items_update_own" on public.invoice_items
  for update using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );
create policy "invoice_items_delete_own" on public.invoice_items
  for delete using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

-- =========================================================================
-- Atomic, per-user invoice number generator: INV-{year}-{0001}
-- Uses row locking on profiles to avoid duplicate numbers under concurrency.
-- =========================================================================
create or replace function public.next_invoice_number(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
  v_year text := to_char(current_date, 'YYYY');
begin
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

grant execute on function public.next_invoice_number(uuid) to authenticated;

-- =========================================================================
-- updated_at triggers
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.customers;
create trigger set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.invoices;
create trigger set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Storage: business logo uploads (public read, owner-only write)
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_owner_update" on storage.objects
  for update using (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );
