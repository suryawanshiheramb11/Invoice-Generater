# Invoice Generator

A production-ready, fully hosted online invoice generator built with **Next.js 16**, **React 19**,
**Supabase**, and **Tailwind CSS v4**. Create professional invoices with a live preview, GST-aware
tax calculations, multiple currencies, five templates, print/PDF export, shareable PDF links, saved
customers, and a dashboard — all backed by a real hosted PostgreSQL database with row-level security.

Nothing in this app depends on localhost, a local backend, or local file storage. Once deployed,
it runs entirely from the browser plus your Supabase project.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Data Flow & How It Works](#data-flow--how-it-works)
- [Database Schema (Supabase)](#database-schema-supabase)
- [Authentication Flow](#authentication-flow)
- [PDF Generation & Sharing](#pdf-generation--sharing)
- [Currency-Safe Money Math](#currency-safe-money-math)
- [Templates & Customization](#templates--customization)
- [Guest vs Signed-In Experience](#guest-vs-signed-in-experience)
- [Local Development Setup](#local-development-setup)
- [Supabase Setup](#supabase-setup)
- [Environment Variables](#environment-variables)
- [Deployment (Vercel)](#deployment-vercel)
- [Production Build](#production-build)
- [Key Design Decisions](#key-design-decisions)
- [SEO & Metadata](#seo--metadata)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Category | Details |
|---|---|
| **Invoice Editor** | Full-featured editor with live preview, line items, discounts (per-item & invoice-level), taxes, shipping charges, and custom notes/terms |
| **5 Templates** | Classic, Modern, Minimal, Business, GST — each with distinct header layouts, table styles, and accent colors |
| **PDF Export** | Client-side PDF generation via `@react-pdf/renderer` with embedded Unicode font (₹/€/£/¥ support). No server-side headless browser needed |
| **PDF Sharing** | Save PDF snapshots to Supabase Storage with auto-expiring share links (24h or 7 days) |
| **Web Share API** | Native OS share sheet integration for sending PDFs on mobile/desktop |
| **Tax Modes** | Simple per-item tax **or** Indian GST (CGST + SGST / IGST) with automatic calculation |
| **9 Currencies** | INR, USD, EUR, GBP, AED, CAD, AUD, SGD, JPY — each with correct decimal precision |
| **QR Code** | Auto-generated UPI QR codes for Indian payment collection |
| **Dashboard** | Stats cards (total invoices, revenue, paid/overdue counts) and a searchable, filterable invoices table |
| **Customer Management** | Save, edit, and reuse customer profiles across invoices |
| **Business Profile** | Save business info (name, logo, address, tax numbers) that auto-fills into new invoices |
| **Logo Upload** | Upload business logos directly to Supabase Storage (CDN-served, max 2 MB) |
| **Authentication** | Email/password signup, login, password reset, email confirmation, and Google OAuth — all via Supabase Auth |
| **Guest Mode** | Create, preview, print, and download invoices without any account. Drafts persist to `localStorage` |
| **Autosave** | Debounced autosave for signed-in users — changes persist to the database automatically |
| **Invoice Numbering** | Atomic, per-user sequential numbers (`INV-2026-0001`) via a Postgres function with row locking |
| **Row Level Security** | Every table enforces that users can only read/write their own data |
| **Responsive Design** | Fully responsive from mobile to desktop with adaptive toolbar layouts |
| **SEO Optimized** | OpenGraph images, structured JSON-LD, sitemap, robots.txt, and `llms.txt` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **UI Library** | [React 19](https://react.dev/) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL 15+) |
| **Auth** | Supabase Auth (email/password + Google OAuth) |
| **Storage** | Supabase Storage (logos + PDF exports) |
| **PDF Rendering** | [`@react-pdf/renderer`](https://react-pdf.org/) (client-side) |
| **QR Codes** | [`qrcode`](https://www.npmjs.com/package/qrcode) |
| **Forms** | [`react-hook-form`](https://react-hook-form.com/) + [`zod`](https://zod.dev/) |
| **Icons** | [`lucide-react`](https://lucide.dev/) |
| **Date Formatting** | [`date-fns`](https://date-fns.org/) |
| **Hosting** | [Vercel](https://vercel.com/) (frontend) + Supabase (backend) |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────────┐│
│  │ React UI   │→ │ Services     │→ │ Supabase JS Client        ││
│  │ Components │  │ Layer        │  │ (@supabase/supabase-js)    ││
│  │            │  │              │  │                             ││
│  │ • Editor   │  │ • invoices   │  │ • Auth (signup/login/OAuth)││
│  │ • Preview  │  │ • customers  │  │ • Database (CRUD via REST) ││
│  │ • Dashboard│  │ • profile    │  │ • Storage (upload/download)││
│  │ • PDF Gen  │  │ • storage    │  │ • RPC (invoice numbers)    ││
│  └────────────┘  │ • pdfExports │  └─────────────┬─────────────┘│
│                  └──────────────┘                │               │
└──────────────────────────────────────────────────┼───────────────┘
                                                   │ HTTPS
                                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Supabase (Hosted Backend)                      │
│                                                                  │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────────┐│
│  │ PostgreSQL   │  │ Supabase Auth  │  │ Supabase Storage      ││
│  │              │  │                │  │                         ││
│  │ • profiles   │  │ • Email/Pass   │  │ • logos bucket (public) ││
│  │ • customers  │  │ • Google OAuth │  │ • invoice-pdfs bucket   ││
│  │ • invoices   │  │ • Magic Links  │  │                         ││
│  │ • items      │  │ • Password     │  │ CDN-served with RLS     ││
│  │ • pdf_exports│  │   Reset        │  │ write policies          ││
│  │              │  └────────────────┘  └───────────────────────┘│
│  │ Row Level Security (RLS)                                      │
│  │ on every table                                                │
│  └──────────────┘                                                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend Hosting)                      │
│                                                                  │
│  • Static/Edge/Serverless rendering via Next.js App Router       │
│  • Middleware: session refresh + protected route redirection      │
│  • No custom server — everything runs on Vercel's edge/serverless│
└──────────────────────────────────────────────────────────────────┘
```

**Key architectural principle**: The browser talks **directly** to Supabase for all data operations.
There is no custom API server. Security is enforced entirely by PostgreSQL Row Level Security (RLS)
policies — the Supabase anon key is safe to expose because it can only do what RLS allows.

---

## Project Structure

```text
invoice-generator/
├── public/
│   ├── fonts/
│   │   └── NotoSans-Variable.ttf    # Embedded in PDFs for Unicode currency symbols
│   └── llms.txt                     # LLM-friendly site description for SEO
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (app)/                   # Route group: authenticated app pages
│   │   │   ├── layout.tsx           # AppShell wrapper (sidebar/navbar)
│   │   │   ├── dashboard/page.tsx   # Invoice list, stats, quick actions
│   │   │   ├── customers/page.tsx   # Customer management CRUD
│   │   │   ├── invoice/
│   │   │   │   ├── new/page.tsx     # Create new invoice
│   │   │   │   └── [id]/page.tsx    # Edit existing invoice
│   │   │   └── settings/page.tsx    # Business profile & preferences
│   │   ├── (marketing)/             # Route group: public/marketing pages
│   │   │   ├── layout.tsx           # Navbar + Footer wrapper
│   │   │   ├── page.tsx             # Landing page with hero, features, FAQ
│   │   │   ├── templates/page.tsx   # Template showcase
│   │   │   ├── login/page.tsx       # Email/password + Google login
│   │   │   ├── signup/page.tsx      # Registration with confirm password
│   │   │   ├── forgot-password/     # Password reset request
│   │   │   ├── reset-password/      # New password form (from email link)
│   │   │   └── confirm-email/       # Post-signup confirmation landing
│   │   ├── auth/
│   │   │   └── callback/route.ts    # OAuth code exchange handler
│   │   ├── share/[token]/page.tsx   # Public PDF share link viewer
│   │   ├── layout.tsx               # Root layout (fonts, metadata, ToastProvider)
│   │   ├── globals.css              # Tailwind v4 + design tokens + component styles
│   │   ├── icon.tsx                 # Dynamic favicon generator
│   │   ├── opengraph-image.tsx      # Dynamic OG social card
│   │   ├── robots.ts               # robots.txt generation
│   │   └── sitemap.ts              # XML sitemap generation
│   ├── components/
│   │   ├── ui/                      # Design-system primitives
│   │   │   ├── Button.tsx           # Variants: primary/outline/ghost, sizes, loading state
│   │   │   ├── Card.tsx             # Content card with optional header/footer
│   │   │   ├── Field.tsx            # Form field wrapper with label, error, description
│   │   │   ├── Modal.tsx            # Accessible dialog with backdrop
│   │   │   └── Toast.tsx            # Toast notification system (context + provider)
│   │   ├── invoice/                 # Invoice editor sub-components
│   │   │   ├── InvoiceEditor.tsx    # Main editor orchestrator (state, autosave, actions)
│   │   │   ├── InvoicePreview.tsx   # Live HTML preview of the invoice
│   │   │   ├── InvoicePdfDocument.tsx # React-PDF document component
│   │   │   ├── BusinessSection.tsx  # Business info form fields
│   │   │   ├── CustomerSection.tsx  # Customer info + saved customer picker
│   │   │   ├── InvoiceInfoSection.tsx # Invoice #, dates, currency, status
│   │   │   ├── ItemsSection.tsx     # Line items table with add/remove/duplicate
│   │   │   ├── TotalsSection.tsx    # Subtotal, discounts, tax, grand total display
│   │   │   ├── PaymentInfoSection.tsx # Bank details, UPI, PayPal fields
│   │   │   ├── NotesSection.tsx     # Notes & terms text areas
│   │   │   ├── CustomizationSection.tsx # Template, accent color, font, layout options
│   │   │   ├── EditorSection.tsx    # Collapsible section container
│   │   │   └── PdfHistorySection.tsx # PDF export history with share links
│   │   ├── dashboard/
│   │   │   ├── StatsCards.tsx       # Revenue, count, paid/overdue stat cards
│   │   │   └── InvoicesTable.tsx    # Sortable, filterable invoices data table
│   │   ├── landing/
│   │   │   ├── Faq.tsx              # Accordion FAQ component
│   │   │   └── TemplateShowcase.tsx # Template preview carousel
│   │   ├── layout/
│   │   │   ├── Navbar.tsx           # Top navigation bar
│   │   │   ├── Footer.tsx           # Site footer
│   │   │   └── AppShell.tsx         # Authenticated app layout shell
│   │   └── auth/
│   │       └── GoogleSignInButton.tsx # Google OAuth sign-in button
│   ├── hooks/
│   │   ├── useUser.ts              # Auth state hook (current user + loading)
│   │   ├── useDebouncedEffect.ts   # Debounced side-effect hook for autosave
│   │   └── useQrDataUrl.ts         # Generate UPI QR code data URL
│   ├── services/                    # Supabase-backed data access layer
│   │   ├── invoices.ts             # CRUD, status updates, duplication, atomic numbering
│   │   ├── customers.ts            # Customer CRUD operations
│   │   ├── profile.ts              # Business profile get/upsert
│   │   ├── storage.ts              # Logo upload to Supabase Storage
│   │   └── pdfExports.ts           # PDF snapshot save, list, delete, share
│   ├── lib/                         # Pure business logic & utilities
│   │   ├── calculations.ts         # Single source of truth for invoice math
│   │   ├── money.ts                # Integer minor-unit arithmetic (no float drift)
│   │   ├── validation.ts           # Invoice validation rules
│   │   ├── templates.ts            # Template style definitions
│   │   ├── defaults.ts             # Default invoice values
│   │   ├── mapInvoice.ts           # DB row ↔ Invoice type mapping
│   │   ├── invoiceStatus.ts        # Status labels, colors, icons
│   │   ├── dates.ts                # Date formatting helpers
│   │   ├── upi.ts                  # UPI URI builder for QR codes
│   │   ├── cn.ts                   # Classname merge utility (clsx)
│   │   ├── errors.ts               # User-friendly error message formatting
│   │   ├── guestStorage.ts         # localStorage draft persistence for guests
│   │   ├── avatar.ts               # User avatar/initials generator
│   │   ├── faqData.ts              # FAQ content data
│   │   ├── pdf.tsx                  # PDF generation + Web Share + download helpers
│   │   └── supabase/
│   │       ├── client.ts           # Browser Supabase client (singleton)
│   │       ├── server.ts           # Server-side Supabase client (cookies)
│   │       ├── middleware.ts        # Next.js middleware for session + route protection
│   │       └── database.types.ts   # Auto-generated Supabase types
│   ├── types/
│   │   └── invoice.ts              # Core domain types (Invoice, InvoiceItem, etc.)
│   └── proxy.ts                    # Development proxy configuration
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql           # Core schema: profiles, customers, invoices, items, RLS, storage
│       ├── 0002_security_fixes.sql # Additional security policy refinements
│       ├── 0003_fix_logo_storage_policies.sql # Logo bucket policy fixes
│       └── 0004_pdf_exports.sql    # PDF exports table, share tokens, cleanup functions
├── .env.example                    # Environment variable template (no secrets!)
├── .gitignore                      # Excludes .env*, node_modules, .next, etc.
├── package.json
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
└── postcss.config.mjs
```

---

## Data Flow & How It Works

### 1. Creating an Invoice (Guest)

```
User opens /invoice/new
  → InvoiceEditor initializes with defaults from lib/defaults.ts
  → User fills in business info, customer, line items
  → lib/calculations.ts computes totals in real-time (minor-unit math)
  → InvoicePreview renders a live HTML preview
  → Changes are debounced (500ms) and saved to localStorage via lib/guestStorage.ts
  → User clicks "Download PDF"
    → lib/pdf.tsx renders <InvoicePdfDocument /> via @react-pdf/renderer
    → PDF blob is generated entirely in the browser
    → Browser triggers file download
```

### 2. Creating an Invoice (Signed-In)

```
User opens /invoice/new
  → InvoiceEditor calls services/invoices.ts → getNextInvoiceNumber()
    → Supabase RPC → next_invoice_number(user_id) in PostgreSQL
    → Atomic row lock on profiles table → returns "INV-2026-0001"
  → services/profile.ts → getBusinessProfile() auto-fills saved business info
  → User edits the invoice
  → Debounced autosave (every 3s if content changed):
    → services/invoices.ts → saveInvoice()
    → Upserts to invoices table + syncs invoice_items rows
    → invoiceSignature() comparison prevents infinite save loops
  → User clicks "Save PDF"
    → services/pdfExports.ts → saveInvoicePdf()
    → Generates PDF blob → uploads to invoice-pdfs Storage bucket
    → Creates invoice_pdf_exports row with share_token + expiry
    → Returns shareable URL: /share/{token}
```

### 3. Viewing a Shared PDF

```
Anyone visits /share/{token}
  → Page calls Supabase RPC → get_pdf_export_by_token(token)
  → Function checks expiry:
    → If expired: deletes storage object + DB row, returns empty
    → If valid: returns storage_path, invoice_number, business_name
  → Page fetches PDF from Supabase Storage public URL
  → Renders download button with invoice metadata
```

### 4. Dashboard

```
User visits /dashboard
  → services/invoices.ts → listInvoices()
  → Supabase SELECT * FROM invoices WHERE user_id = auth.uid() (enforced by RLS)
  → StatsCards computes aggregates (total revenue, paid count, overdue count)
  → InvoicesTable renders sortable/filterable table
  → Quick actions: edit, duplicate, delete, change status
```

---

## Database Schema (Supabase)

All tables live in the `public` schema and have **Row Level Security enabled**.

### Entity Relationship Diagram

```
┌─────────────┐     ┌───────────────────┐     ┌────────────────────────┐
│  auth.users  │────→│    profiles        │     │    customers            │
│  (Supabase)  │     │                   │     │                        │
│              │     │ • business_name   │     │ • name, company        │
│              │     │ • logo_url        │     │ • email, phone         │
│              │     │ • address fields  │     │ • address fields       │
│              │     │ • tax_number      │     │ • tax_id               │
│              │     │ • invoice_sequence│     │ • notes                │
│              │     └───────────────────┘     └────────────────────────┘
│              │              │                          │
│              │     ┌────────┴──────────────────────────┘
│              │     │
│              │     ▼
│              │  ┌───────────────────────────────────────┐
│              │──│              invoices                   │
│              │  │                                         │
│              │  │ • invoice_number (unique per user)      │
│              │  │ • customer_id → customers(id)           │
│              │  │ • invoice_date, due_date                │
│              │  │ • currency, status, template            │
│              │  │ • subtotal, discount, tax, total        │
│              │  │ • invoice_data (JSONB - full state)     │
│              │  └──────────┬──────────────────────────────┘
│              │             │
│              │     ┌───────┴───────────┐  ┌──────────────────────────┐
│              │     │  invoice_items     │  │  invoice_pdf_exports      │
│              │     │                   │  │                           │
│              │     │ • description     │  │ • storage_path            │
│              │     │ • quantity, rate  │  │ • share_token (unique)    │
│              │     │ • tax_rate        │  │ • expires_at              │
│              │     │ • discount        │  │                           │
│              │     │ • amount          │  │ → RPC: get_pdf_export_by_ │
│              │     └───────────────────┘  │   token() for public view │
│              │                            └──────────────────────────┘
└──────────────┘
```

### Tables

| Table | Purpose | RLS Policy |
|---|---|---|
| `profiles` | One row per user — business info, logo URL, invoice sequence counter | Owner read/write only |
| `customers` | Saved customer contacts reusable across invoices | Owner read/write only |
| `invoices` | Invoice header data + full editor state in `invoice_data` JSONB | Owner read/write only |
| `invoice_items` | Relational line items (enables SQL analytics on individual items) | Owner via parent invoice |
| `invoice_pdf_exports` | PDF snapshot metadata with share tokens and expiry timestamps | Owner read/write; public read via RPC |

### Postgres Functions

| Function | Purpose |
|---|---|
| `next_invoice_number(user_id)` | Atomic, per-user sequential invoice number generation with row locking. Returns `INV-{year}-{0001}`. Runs as `SECURITY INVOKER` with explicit caller authorization check. |
| `set_updated_at()` | Trigger function that auto-updates `updated_at` on row modification. |
| `get_pdf_export_by_token(token)` | `SECURITY DEFINER` function for public share link resolution. Auto-deletes expired links. |
| `cleanup_expired_pdf_exports()` | Opportunistic sweep of expired PDF exports (storage + DB rows). Called before new exports. |

### Storage Buckets

| Bucket | Public | Max Size | Allowed Types | Write Policy |
|---|---|---|---|---|
| `logos` | ✅ (CDN-served) | 2 MB | PNG, JPEG, WebP, SVG | Owner only (`{user_id}/...` path) |
| `invoice-pdfs` | ✅ (CDN-served) | 10 MB | PDF | Owner only (`{user_id}/...` path) |

---

## Authentication Flow

```
                  ┌──────────────────┐
                  │   Landing Page   │
                  └────────┬─────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌────────────────┐       ┌─────────────────┐
     │  Email/Password │       │  Google OAuth    │
     │  Signup/Login   │       │  (via Supabase)  │
     └───────┬────────┘       └────────┬─────────┘
             │                         │
             ▼                         ▼
     ┌────────────────┐       ┌─────────────────┐
     │ Email confirm  │       │ /auth/callback   │
     │ link sent      │       │ code exchange    │
     └───────┬────────┘       └────────┬─────────┘
             │                         │
             ▼                         │
     ┌────────────────┐                │
     │ /confirm-email │                │
     │ landing page   │                │
     └───────┬────────┘                │
             │ (clicks email link)     │
             ▼                         │
     ┌────────────────┐                │
     │ /auth/callback  │◄──────────────┘
     │ session created │
     └───────┬────────┘
             │
             ▼
     ┌────────────────┐
     │   Dashboard    │
     └────────────────┘
```

**Middleware** (`src/lib/supabase/middleware.ts`) runs on every request:
- Refreshes the Supabase session cookie
- Redirects unauthenticated users away from protected routes (`/dashboard`, `/customers`, `/settings`) to `/login`

**Protected routes**: `/dashboard`, `/customers`, `/settings`, `/invoice/[id]`  
**Public routes**: `/`, `/templates`, `/invoice/new`, `/login`, `/signup`, `/share/[token]`

---

## PDF Generation & Sharing

### Generation Pipeline

```
Invoice State (TypeScript object)
  → <InvoicePdfDocument /> (React-PDF component)
    → @react-pdf/renderer's pdf().toBlob()
      → PDF Blob (entirely in-browser, no server round-trip)
        → File object with filename "{invoiceNumber}.pdf"
```

- **Font**: NotoSans Variable TTF is embedded in the PDF for Unicode currency symbols (₹, €, £, ¥)
- **No headless browser**: unlike many invoice tools, this never shells out to Puppeteer/Playwright
- **Works on serverless**: since PDF generation is client-side, there's no timeout risk on Vercel/Netlify

### Share Flow

1. User clicks **Save PDF** → chooses retention (24 hours or 7 days)
2. PDF is generated client-side and uploaded to the `invoice-pdfs` Storage bucket
3. A `invoice_pdf_exports` row is created with a cryptographic `share_token`
4. Share URL: `https://your-domain.com/share/{share_token}`
5. Anyone with the link can view/download — no login required
6. Expired links are auto-cleaned on access and opportunistically before new saves

### Web Share API

On devices that support file sharing (mobile browsers, macOS), the **Share** button triggers the
native OS share sheet, letting users send the PDF via WhatsApp, Email, AirDrop, etc. Falls back
to a standard download on unsupported browsers.

---

## Currency-Safe Money Math

**Problem**: JavaScript floating-point: `0.1 + 0.2 = 0.30000000000000004`

**Solution** (`src/lib/money.ts`): All monetary arithmetic is done in **integer minor units**
(paise, cents, etc.), then converted back to display precision at the boundary.

```
Input: ₹100.50 × 3 items
  → toMinorUnits(100.50, "INR") = 10050 (paise)
  → 10050 × 3 = 30150 (integer math, no float drift)
  → fromMinorUnits(30150, "INR") = ₹301.50
```

The `CurrencyCode` type carries the decimal precision:
- **JPY** = 0 decimals (¥100, not ¥1.00)
- **INR/USD/EUR/GBP/etc.** = 2 decimals

### Single Calculation Engine

`src/lib/calculations.ts` is the **only** place invoice totals are computed. It's consumed by:
- The live editor preview
- The PDF document
- The dashboard stats

This guarantees all three always show identical numbers.

---

## Templates & Customization

Five built-in templates with distinct visual personalities:

| Template | Header Layout | Table Style | Default Accent | Best For |
|---|---|---|---|---|
| **Classic** | Split | Lined | `#1f2937` (dark gray) | Traditional businesses |
| **Modern** | Split | Zebra | `#00A97C` (teal) | Freelancers, agencies |
| **Minimal** | Stacked | Minimal | `#111111` (near-black) | Clean, simple invoices |
| **Business** | Banner | Boxed | `#0f766e` (deep teal) | Corporate use |
| **GST** | Banner | Boxed | `#b45309` (amber) | Indian GST compliance |

Each template is defined in `src/lib/templates.ts` as a `TemplateStyle` object. Users can further
customize:
- **Accent color** (color picker)
- **Logo position** (left / center / right)
- **Date format** (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD MMM YYYY)
- **Show/hide columns** (tax column, discount column, payment info)

---

## Guest vs Signed-In Experience

| Feature | Guest | Signed-In |
|---|---|---|
| Create invoices | ✅ | ✅ |
| Live preview | ✅ | ✅ |
| Print invoices | ✅ | ✅ |
| Download PDF | ✅ | ✅ |
| Web Share PDF | ✅ | ✅ |
| Auto-fill business info | ❌ | ✅ (from profile) |
| Save invoices to cloud | ❌ | ✅ (Supabase) |
| Dashboard & stats | ❌ | ✅ |
| Customer management | ❌ | ✅ |
| Invoice numbering | Local placeholder | Atomic, unique |
| Draft persistence | `localStorage` | PostgreSQL |
| PDF share links | ❌ | ✅ (24h or 7d) |
| Logo upload | ❌ | ✅ (Supabase Storage) |

---

## Local Development Setup

### Prerequisites

- **Node.js** 18+ (recommended: 20+)
- **npm** 9+
- A [Supabase](https://supabase.com/) project (free tier works)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/suryawanshiheramb11/Invoice-Generater-.git
cd Invoice-Generater-

# 2. Install dependencies
npm install

# 3. Create environment file from template
cp .env.example .env.local

# 4. Fill in your Supabase credentials in .env.local
#    (see "Environment Variables" and "Supabase Setup" below)

# 5. Start the development server
npm run dev
```

The app runs at `http://localhost:3000`. Local dev still talks to your **hosted** Supabase
project — there is no local backend to run.

**Without Supabase configured**, the marketing pages and the guest invoice editor (create, preview,
print, download PDF) still work — auth, saving, dashboard, and customers require Supabase.

---

## Supabase Setup

### 1. Create a Project

Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.

### 2. Get Your API Keys

In **Project Settings → API**, copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Run Database Migrations

Run all migration files in `supabase/migrations/` in order. You can either:

**Option A: Supabase Dashboard (SQL Editor)**
1. Open the SQL Editor in your Supabase dashboard
2. Paste and run each file in order:
   - `0001_init.sql`
   - `0002_security_fixes.sql`
   - `0003_fix_logo_storage_policies.sql`
   - `0004_pdf_exports.sql`

**Option B: Supabase CLI**
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Configure Authentication

In **Authentication → URL Configuration**:
- Set **Site URL** to your deployed domain (e.g., `https://your-app.vercel.app`)
- Add `http://localhost:3000` to **Redirect URLs** for local development

**For Google OAuth** (optional):
1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
2. In Supabase **Authentication → Providers → Google**, enable and paste your Client ID and Secret

### 5. Verify Storage Buckets

After running migrations, verify in **Storage** that two buckets exist:
- `logos` (public, 2 MB limit, image types only)
- `invoice-pdfs` (public, 10 MB limit, PDF only)

---

## Environment Variables

All configuration is in `.env.local` (git-ignored). See `.env.example` for the template:

```bash
# Supabase project settings (Project Settings → API in the Supabase dashboard).
# These are safe to expose to the browser: the anon key only grants what your
# Row Level Security policies allow.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Public URL of this deployment, used for SEO metadata (Open Graph, canonical URLs)
# and as the default redirect target after email confirmation.
NEXT_PUBLIC_SITE_URL=
```

> **⚠️ Important**: All variables are `NEXT_PUBLIC_*` because Supabase's anon key is **designed**
> to be public. Security is enforced entirely by Row Level Security policies in PostgreSQL, not by
> keeping the key secret. **No server-side secret keys are used by this app.**

> **🔒 Never commit `.env.local`** or any file containing actual keys. The `.gitignore` already
> excludes `.env*` patterns.

---

## Deployment (Vercel)

1. **Push** this repository to GitHub
2. **Import** it into [Vercel](https://vercel.com/new)
3. **Add environment variables** from `.env.example` in the Vercel project settings
4. **Deploy** — Vercel builds with `next build` and serves the app. No post-deploy commands needed.
5. **Configure Supabase**: Set **Authentication → URL Configuration → Site URL** to your Vercel
   production URL so auth email links point to the live site

Vercel's static/edge/serverless mix works out of the box with the App Router. The only "server"
code in this project is Next.js middleware for session refresh and protected route redirection —
both run fine on Vercel's edge runtime.

---

## Production Build

```bash
npm run build   # Type-checks, lints, and produces the production bundle
npm start       # Serve the production build locally for a final smoke test
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Currency-safe math** | All monetary arithmetic in integer minor units (`src/lib/money.ts`) prevents `0.1 + 0.2 ≠ 0.3` errors |
| **Single calculation engine** | `src/lib/calculations.ts` is the only place totals are computed — preview, PDF, and dashboard always agree |
| **Client-side PDF** | `@react-pdf/renderer` runs entirely in the browser, eliminating server-side headless browser dependencies that fail or timeout on serverless |
| **Guest mode** | Anyone can create invoices without signup. Drafts persist to `localStorage`; signing in upgrades to cloud persistence |
| **JSONB + relational items** | `invoice_data` JSONB stores the full editor state for exact round-trips, while `invoice_items` enables SQL analytics on individual line items |
| **Atomic invoice numbering** | PostgreSQL function with row locking guarantees unique sequential numbers even under concurrent requests |
| **RLS everywhere** | Every table has row-level security. The anon key is public by design — security is in the database, not in key secrecy |
| **No custom API server** | The browser talks directly to Supabase. Less infrastructure, fewer moving parts, easier deployment |
| **Route groups** | `(app)` and `(marketing)` route groups share the root layout but have distinct sub-layouts (AppShell vs Navbar+Footer) |
| **Debounced autosave with signature** | Autosave only fires when content actually changes (ignoring server-set `updatedAt` timestamps) to prevent infinite save loops |

---

## SEO & Metadata

- **Dynamic OpenGraph image** (`src/app/opengraph-image.tsx`) — auto-generated social card
- **Sitemap** (`src/app/sitemap.ts`) — XML sitemap for search engine indexing
- **Robots.txt** (`src/app/robots.ts`) — crawler directives
- **Structured data** — JSON-LD `FAQPage` schema on the landing page
- **`llms.txt`** (`public/llms.txt`) — LLM-friendly site description
- **Meta tags** — title, description, keywords, canonical URL, OpenGraph, Twitter Card
- **Semantic HTML** — proper heading hierarchy, `<main>`, `<section>`, `<article>` elements

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: description of change"`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

This project is open source and available under the [MIT License](LICENSE).
