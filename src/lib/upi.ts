import type { CurrencyCode, PaymentInfo } from "@/types/invoice";

/**
 * Builds a UPI deep-link payment URI per the standard `upi://pay` intent spec.
 * Only generated when a UPI ID is present; amount/currency included when INR.
 */
export function buildUpiUri(
  paymentInfo: PaymentInfo,
  payeeName: string,
  amount: number,
  currency: CurrencyCode,
  invoiceNumber: string
): string | null {
  if (!paymentInfo.upiId) return null;

  const params = new URLSearchParams();
  params.set("pa", paymentInfo.upiId);
  params.set("pn", payeeName || "Payee");
  params.set("tn", `Invoice ${invoiceNumber}`);
  if (currency === "INR" && amount > 0) {
    params.set("am", amount.toFixed(2));
    params.set("cu", "INR");
  }

  return `upi://pay?${params.toString()}`;
}
