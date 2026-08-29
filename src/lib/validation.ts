import type { Invoice } from "@/types/invoice";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lightweight client-side validation surfaced as user-friendly error messages before save/print/download. */
export function validateInvoice(invoice: Invoice): string[] {
  const errors: string[] = [];

  if (!invoice.business.name.trim()) errors.push("Business name is required.");
  if (!invoice.customer.name.trim()) errors.push("Customer name is required.");
  if (!invoice.invoiceNumber.trim()) errors.push("Invoice number is required.");
  if (!invoice.invoiceDate) errors.push("Invoice date is required.");
  if (!invoice.dueDate) errors.push("Due date is required.");

  if (invoice.business.email && !EMAIL_RE.test(invoice.business.email)) {
    errors.push("Business email is invalid.");
  }
  if (invoice.customer.email && !EMAIL_RE.test(invoice.customer.email)) {
    errors.push("Customer email is invalid.");
  }

  if (invoice.items.length === 0) {
    errors.push("Add at least one invoice item.");
  }
  invoice.items.forEach((item, idx) => {
    if (!item.name.trim()) errors.push(`Item ${idx + 1}: name is required.`);
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push(`Item ${idx + 1}: quantity must be a positive number.`);
    }
    if (!Number.isFinite(item.rate) || item.rate < 0) {
      errors.push(`Item ${idx + 1}: rate must be zero or greater.`);
    }
  });

  return errors;
}
