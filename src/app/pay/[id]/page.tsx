import Link from "next/link";
import QRCode from "qrcode";
import { CreditCard, ExternalLink, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PaymentProofForm } from "@/components/invoice/PaymentProofForm";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { remainingBalance } from "@/lib/paymentBalance";
import type { CurrencyCode, InvoiceStatus } from "@/types/invoice";

interface PaymentInfo {
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  swift?: string;
  upiId?: string;
  paymentLink?: string;
  paypalEmail?: string;
}

/** Mirrors src/lib/upi.ts's buildUpiUri, inlined to avoid needing a full PaymentInfo object here. */
function buildUpiPayUrl(upiId: string, payeeName: string, amount: number, invoiceNumber: string): string {
  const params = new URLSearchParams();
  params.set("pa", upiId);
  params.set("pn", payeeName || "Payee");
  params.set("tn", `Invoice ${invoiceNumber}`);
  if (amount > 0) {
    params.set("am", amount.toFixed(2));
    params.set("cu", "INR");
  }
  return `upi://pay?${params.toString()}`;
}

/**
 * Permanent public "pay this invoice" page — the link embedded in every generated PDF
 * (see InvoicePdfDocument's payUrl) so a client who only ever receives the PDF file
 * itself, not a separately-sent share link, still has a way to pay or submit proof.
 * Unlike /share/[token], this never expires: it's keyed by invoice id alone, which is
 * already the trust boundary for payment proof uploads (see migration 0006/0008).
 */
export default async function PayInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_invoice_summary", { p_invoice_id: id });
  const result = data?.[0];

  if (!result) {
    return (
      <div className="mx-auto max-w-sm px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-foreground">Invoice not found</h1>
        <p className="mt-2 text-sm text-muted">This payment link doesn&apos;t match any invoice, or it&apos;s been deleted.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-bold text-accent hover:text-accent-hover">
          Go to Invoice Generator
        </Link>
      </div>
    );
  }

  const currency = result.currency as CurrencyCode;
  const paymentInfo = (result.payment_info ?? {}) as PaymentInfo;
  const hasPaymentDetails =
    result.show_payment_info &&
    Boolean(
      paymentInfo.bankName ||
        paymentInfo.accountNumber ||
        paymentInfo.upiId ||
        paymentInfo.paypalEmail ||
        paymentInfo.paymentLink
    );

  const remaining = remainingBalance(result.status as InvoiceStatus, result.total, result.paid_amount ?? 0);
  const upiPayUrl =
    result.show_payment_info && paymentInfo.upiId && currency === "INR" && remaining > 0
      ? buildUpiPayUrl(paymentInfo.upiId, result.business_name ?? "", remaining, result.invoice_number)
      : null;
  const upiQrDataUrl = upiPayUrl ? await QRCode.toDataURL(upiPayUrl, { margin: 1, width: 220 }).catch(() => null) : null;

  return (
    <div className="mx-auto max-w-sm px-4 py-24 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-accent">
        <CreditCard className="h-7 w-7" />
      </span>
      <h1 className="mt-6 font-display text-2xl font-extrabold text-foreground">
        Invoice {result.invoice_number}
      </h1>
      {result.business_name && <p className="mt-1 text-sm text-muted">from {result.business_name}</p>}

      <div className="mt-6 rounded-2xl bg-[#F9FBF9] px-5 py-5 text-left">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">
            {result.status === "partially_paid" ? "Remaining balance" : "Amount due"}
          </span>
          <span className="font-display text-xl font-extrabold text-foreground">{formatMoney(remaining, currency)}</span>
        </div>
        {result.status === "partially_paid" && (
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-muted">Invoice total</span>
            <span className="text-xs text-muted">{formatMoney(result.total, currency)}</span>
          </div>
        )}
        {result.due_date && (
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-muted">Due</span>
            <span className="text-xs font-bold text-foreground">{formatDate(result.due_date, "DD MMM YYYY")}</span>
          </div>
        )}
      </div>

      {upiPayUrl && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border px-5 py-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Pay by UPI</p>
          {upiQrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a data: URI, not an optimizable remote image
            <img src={upiQrDataUrl} alt="UPI QR code" width={180} height={180} className="rounded-xl" />
          )}
          <a
            href={upiPayUrl}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground hover:bg-accent-hover"
          >
            <Smartphone className="h-4 w-4" /> Open in UPI app
          </a>
          <p className="text-[11px] text-muted">On your phone, this opens GPay, PhonePe, Paytm, or your banking app. On desktop, scan the QR instead.</p>
        </div>
      )}

      {hasPaymentDetails && (
        <div className="mt-4 rounded-2xl border border-border px-5 py-5 text-left">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">How to pay</p>
          {result.payment_instructions && <p className="mb-2 text-sm text-muted">{result.payment_instructions}</p>}
          <div className="space-y-1 text-sm text-foreground">
            {paymentInfo.bankName && <p>Bank: {paymentInfo.bankName}</p>}
            {paymentInfo.accountHolder && <p>Account Holder: {paymentInfo.accountHolder}</p>}
            {paymentInfo.accountNumber && <p>Account No: {paymentInfo.accountNumber}</p>}
            {paymentInfo.ifsc && <p>IFSC: {paymentInfo.ifsc}</p>}
            {paymentInfo.swift && <p>SWIFT: {paymentInfo.swift}</p>}
            {paymentInfo.upiId && <p>UPI ID: {paymentInfo.upiId}</p>}
            {paymentInfo.paypalEmail && <p>PayPal: {paymentInfo.paypalEmail}</p>}
          </div>
          {paymentInfo.paymentLink && (
            <a
              href={paymentInfo.paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:text-accent-hover"
            >
              Open payment link <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      <PaymentProofForm invoiceId={id} initialStatus={result.status} remainingBalance={remaining} currency={currency} />

      <p className="mt-10 text-xs text-muted">
        Made with{" "}
        <Link href="/" className="font-bold text-accent hover:text-accent-hover">
          Invoice Generator
        </Link>{" "}
        — create your own free invoices in seconds.
      </p>
    </div>
  );
}
