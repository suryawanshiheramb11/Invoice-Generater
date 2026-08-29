import type { Database } from "@/lib/supabase/database.types";
import type { Invoice } from "@/types/invoice";
import { calculateInvoiceTotals } from "@/lib/calculations";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

/** Maps the full editor Invoice object to the columns + jsonb payload stored in Postgres. */
export function invoiceToRow(
  invoice: Invoice,
  userId: string
): Database["public"]["Tables"]["invoices"]["Insert"] {
  const totals = calculateInvoiceTotals(invoice);
  return {
    ...(invoice.id ? { id: invoice.id } : {}),
    user_id: userId,
    invoice_number: invoice.invoiceNumber,
    customer_id: invoice.customer.id,
    invoice_date: invoice.invoiceDate,
    due_date: invoice.dueDate,
    currency: invoice.currency,
    status: invoice.status,
    subtotal: totals.subtotal,
    discount: totals.invoiceDiscount + totals.itemDiscountTotal,
    tax: totals.totalTax,
    shipping: totals.shipping,
    other_charges: totals.otherCharges,
    total: totals.total,
    template: invoice.template,
    invoice_data: invoice as unknown as Database["public"]["Tables"]["invoices"]["Row"]["invoice_data"],
  };
}

/** Maps a stored invoice row back to the full editor Invoice object. */
export function rowToInvoice(row: InvoiceRow): Invoice {
  const stored = row.invoice_data as unknown as Invoice;
  return {
    ...stored,
    id: row.id,
    userId: row.user_id,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    currency: row.currency as Invoice["currency"],
    status: row.status as Invoice["status"],
    template: row.template as Invoice["template"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customer: { ...stored.customer, id: row.customer_id },
  };
}
