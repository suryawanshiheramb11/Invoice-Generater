# Invoice Generator

A production-ready, fully hosted online invoice generator. Create professional invoices with a
live preview, GST-aware tax calculations, multiple currencies, five templates, print/PDF export,
saved customers, and a dashboard — all backed by a real hosted database with row-level security.

Nothing in this app depends on localhost, a local backend, or local file storage. Once deployed,
it runs entirely from the browser plus your Supabase project.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Row Level Security + Auth + Storage)
- **PDF generation**: `@react-pdf/renderer`, rendered entirely client-side (no headless browser, no server function)
- **Validation**: hand-written, currency-safe money math (integer minor units, no floating-point drift)
- **Hosting**: designed for Vercel (frontend) + Supabase (backend/storage)

## Project Structure

```text
src/
├── app/                  # Routes (App Router): landing, invoice editor, dashboard, auth, etc.
├── components/
│   ├── ui/               # Design-system primitives (Button, Field, Card, Modal, Toast...)
│   ├── invoice/           # Invoice editor sections, live preview, PDF document
│   ├── dashboard/         # Stats cards, invoices table
│   └── landing/           # Marketing page sections
├── hooks/                # useUser, useDebouncedEffect, useQrDataUrl
├── services/             # Supabase-backed CRUD: invoices, customers, profile, storage
├── lib/                  # Calculation engine, money math, templates, validation, Supabase clients
└── types/                # Shared TypeScript types (Invoice, CustomerRecord, ...)
supabase/
└── migrations/0001_init.sql   # Tables, RLS policies, storage bucket, invoice-number function
```

Business logic (calculations, validation, formatting) lives in `src/lib/`, entirely separate from
UI components, and is unit-testable in isolation.

## Local Development Setup

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project values (see below)
npm run dev
```

The app runs at `http://localhost:3000`. Local dev still talks to your **hosted** Supabase
project — there is no local backend.

Without Supabase configured, the marketing pages and the guest invoice editor (create, preview,
print, download PDF) still work — auth, saving, dashboard, and customers require Supabase.

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. In **Project Settings → API**, copy the **Project URL** and **anon public key** into `.env.local`
   as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run the migration in `supabase/migrations/0001_init.sql` — either:
   - Paste its contents into the Supabase dashboard's **SQL Editor** and run it, or
   - Use the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.

The migration creates:

- `profiles`, `customers`, `invoices`, `invoice_items` tables with Row Level Security so a user can
  only ever read/write their own rows.
- `next_invoice_number(user_id)`: an atomic, per-user Postgres function that generates
  `INV-{year}-{0001}` style numbers without duplicates, even under concurrent requests.
- A public `logos` storage bucket with policies restricting uploads to `{user_id}/...` paths owned
  by the uploading user, capped at 2MB and limited to image MIME types.

### Authentication

Supabase Auth handles email/password signup, login, logout, and password reset out of the box —
no custom credential handling in this app. In **Authentication → URL Configuration**, set your
site URL (and `NEXT_PUBLIC_SITE_URL`) to your deployed domain so confirmation and reset-password
emails link back correctly.

### Storage

Business logos upload directly from the browser to the `logos` Supabase Storage bucket created by
the migration and are served from Supabase's CDN — never written to a local or server filesystem.

## Environment Variables

See `.env.example`. All variables are `NEXT_PUBLIC_*` because Supabase's anon key is designed to be
public; security is enforced entirely by the Row Level Security policies in the migration, not by
keeping the key secret. No server-side secret keys are used by this app.

## Deployment (Vercel)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import it into [Vercel](https://vercel.com/new).
3. Add the environment variables from `.env.example` in the Vercel project settings.
4. Deploy. Vercel builds with `next build` and serves the app — no post-deploy commands needed.
5. In Supabase, set **Authentication → URL Configuration → Site URL** to your Vercel production URL
   so auth email links point to the live site.

Vercel's static/edge/serverless mix works out of the box with the App Router; the only "server"
code in this project is Next.js middleware/proxy for session refresh and the Supabase RPC — both
run fine on Vercel.

## Production Build

```bash
npm run build   # type-checks, lints via next build, and produces the production bundle
npm start       # serve the production build locally, for a final smoke test
```

## Key Design Decisions

- **Currency-safe math**: all monetary arithmetic happens in integer minor units
  (`src/lib/money.ts`) to avoid floating-point errors like `0.1 + 0.2 = 0.30000000000000004`.
- **Single calculation engine**: `src/lib/calculations.ts` is the only place invoice totals are
  computed — used by the live preview, the PDF, and the dashboard stats, so they can never drift
  apart.
- **Guest mode**: anyone can build, preview, print, and download an invoice without an account.
  Guest drafts persist to `localStorage` as a convenience only; signed-in users are always
  persisted to the database, never to browser storage.
- **PDF generation**: rendered fully client-side with `@react-pdf/renderer` (Unicode font embedded
  for ₹/€/£/¥ support), so there's no headless-browser server dependency that could fail or time
  out on a serverless host.
