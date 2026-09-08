import type { InvoiceStatus } from "@/types/invoice";

/**
 * How much of an invoice is still owed. "paid"/"partially_paid" subtract whatever's been
 * confirmed (owner-approved) so far, floored at zero so a rounding slip never shows a
 * negative balance; anything else (draft/sent/overdue/cancelled) owes the full total.
 *
 * "paid" does NOT mean approvedAmount already covers the total: a client's own claim
 * flips status to "paid" immediately, before the owner (or the OCR check) has confirmed
 * anything — see submit_payment_proof. Treating "paid" as an automatic zero here used to
 * make an unverified, or even OCR-mismatched, claim show "amount due: 0" the moment it
 * was submitted. Deriving the balance from approvedAmount in both branches means it only
 * reaches zero once a proof is actually approved.
 */
export function remainingBalance(status: InvoiceStatus, total: number, approvedAmount: number): number {
  if (status === "paid" || status === "partially_paid") return Math.max(0, total - approvedAmount);
  return total;
}
