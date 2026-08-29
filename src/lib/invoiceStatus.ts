import type { Invoice, InvoiceStatus } from "@/types/invoice";
import { isOverdue } from "@/lib/dates";

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<InvoiceStatus, "default" | "success" | "warning" | "danger" | "accent"> = {
  draft: "default",
  sent: "accent",
  paid: "success",
  partially_paid: "warning",
  overdue: "danger",
  cancelled: "default",
};

/** Derives the status to *display*, auto-flagging unpaid invoices past their due date as overdue. */
export function displayStatus(invoice: Pick<Invoice, "status" | "dueDate">): InvoiceStatus {
  if (invoice.status === "sent" || invoice.status === "partially_paid") {
    if (isOverdue(invoice.dueDate, invoice.status)) return "overdue";
  }
  return invoice.status;
}
