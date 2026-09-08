import Link from "next/link";
import { CreditCard, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PaymentProofForm } from "@/components/invoice/PaymentProofForm";
import { UpiPaySection } from "@/components/invoice/UpiPaySection";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { remainingBalance } from "@/lib/paymentBalance";
import { safeExternalUrl } from "@/lib/urls";
import type { CurrencyCode, InvoiceStatus } from "@/types/invoice";

/**
 * This page shows an amount owed and (when the owner opted in) their bank/UPI details, all
 * behind nothing but an unguessable id. Keep it out of search indexes: a single indexed
 * /pay/<uuid> turns "unguessable" into "first result".
 */
export const metadata = {
  robots: { index: false, follow: false, nocache: true },
};

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

  // Owner-supplied, so never trusted as an href without scheme filtering — see safeExternalUrl.
  const paymentLinkUrl = safeExternalUrl(paymentInfo.paymentLink);
  const paidAmount = result.paid_amount ?? 0;
  const remaining = remainingBalance(result.status as InvoiceStatus, result.total, paidAmount);
  const showUpi = result.show_payment_info && Boolean(paymentInfo.upiId) && currency === "INR" && remaining > 0;

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
        {paidAmount > 0 && (
          <>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xs text-muted">Invoice total</span>
              <span className="text-xs text-muted">{formatMoney(result.total, currency)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xs text-muted">Paid so far</span>
              <span className="text-xs font-bold text-success">{formatMoney(paidAmount, currency)}</span>
            </div>
          </>
        )}
        {result.due_date && (
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-muted">Due</span>
            <span className="text-xs font-bold text-foreground">{formatDate(result.due_date, "DD MMM YYYY")}</span>
          </div>
        )}
      </div>

      {showUpi && (
        <UpiPaySection
          upiId={paymentInfo.upiId!}
          payeeName={result.business_name ?? ""}
          amount={remaining}
          currency={currency}
          invoiceNumber={result.invoice_number}
        />
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
          {paymentLinkUrl && (
            <a
              href={paymentLinkUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
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
