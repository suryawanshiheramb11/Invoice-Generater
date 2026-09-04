import type { InvoiceStatus } from "@/types/invoice";

/**
 * How much of an invoice is still owed. "paid" is always fully settled by definition
 * regardless of what's on record for it; "partially_paid" subtracts whatever's been
 * confirmed (owner-approved) so far, floored at zero so a rounding slip never shows a
 * negative balance; anything else (draft/sent/overdue/cancelled) owes the full total.
 */
export function remainingBalance(status: InvoiceStatus, total: number, approvedAmount: number): number {
  if (status === "paid") return 0;
  if (status === "partially_paid") return Math.max(0, total - approvedAmount);
  return total;
}
