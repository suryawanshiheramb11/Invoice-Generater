import { createClient } from "@/lib/supabase/client";
import { invoiceToRow, rowToInvoice } from "@/lib/mapInvoice";
import type { Invoice, InvoiceStatus } from "@/types/invoice";
import { generateItemId } from "@/lib/calculations";

export class ServiceError extends Error {}

/** Requests the next atomic, per-user invoice number from Postgres (never duplicates for the same account). */
export async function getNextInvoiceNumber(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Guests get a locally-scoped placeholder number; it is regenerated server-side on save.
    const year = new Date().getFullYear();
    return `INV-${year}-0001`;
  }
  const { data, error } = await supabase.rpc("next_invoice_number", { p_user_id: user.id });
  if (error) throw new ServiceError(error.message);
  return data as string;
}

export async function saveInvoice(invoice: Invoice): Promise<Invoice> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ServiceError("You must be signed in to save invoices.");

  const row = invoiceToRow(invoice, user.id);
  const { data, error } = await supabase
    .from("invoices")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) throw new ServiceError(error.message);

  // invoice_items used to be fully deleted and reinserted here on every save — but nothing
  // in the app ever reads that table; line items live entirely in the invoices.invoice_data
  // jsonb column (see rowToInvoice below). That made it a pure write-only shadow copy,
  // rewritten wholesale on every autosave (a delete + insert round trip, regardless of how
  // many items actually changed) for no functional benefit — the single largest source of
  // query volume against this database. Removed rather than "optimized": there was nothing
  // here worth keeping. If a real use for a queryable per-item table shows up later (e.g.
  // per-item reporting), it should be resynced deliberately for that purpose, not as a
  // silent side effect of every save.

  return rowToInvoice(data);
}

export async function listInvoices(): Promise<Invoice[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new ServiceError(error.message);
  return (data ?? []).map(rowToInvoice);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (error) throw new ServiceError(error.message);
  return data ? rowToInvoice(data) : null;
}

export async function deleteInvoice(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw new ServiceError(error.message);
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
  if (error) throw new ServiceError(error.message);
}

/** Builds a duplicate of an invoice with a fresh id/number/date, ready to save as a new record. */
export async function prepareDuplicateInvoice(source: Invoice): Promise<Invoice> {
  const invoiceNumber = await getNextInvoiceNumber();
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...source,
    id: null,
    invoiceNumber,
    invoiceDate: today,
    status: "draft",
    items: source.items.map((item) => ({ ...item, id: generateItemId() })),
    createdAt: null,
    updatedAt: null,
  };
}
