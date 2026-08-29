import { createClient } from "@/lib/supabase/client";
import { invoiceToRow, rowToInvoice } from "@/lib/mapInvoice";
import type { Invoice, InvoiceStatus } from "@/types/invoice";
import { calculateInvoiceTotals } from "@/lib/calculations";
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

  await syncInvoiceItems(data.id, invoice);

  return rowToInvoice(data);
}

async function syncInvoiceItems(invoiceId: string, invoice: Invoice) {
  const supabase = createClient();
  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  if (invoice.items.length === 0) return;

  const rows = invoice.items.map((item) => {
    const amount = calculateInvoiceTotals({ ...invoice, items: [item] }).total;
    return {
      id: item.id.length === 36 ? item.id : undefined,
      invoice_id: invoiceId,
      description: item.name ? `${item.name}${item.description ? " — " + item.description : ""}` : item.description,
      quantity: item.quantity,
      rate: item.rate,
      tax_rate: item.taxRate,
      discount: item.discountValue,
      amount,
    };
  });

  await supabase.from("invoice_items").insert(rows);
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
