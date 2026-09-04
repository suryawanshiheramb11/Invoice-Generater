import Link from "next/link";
import { FileText, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PaymentProofForm } from "@/components/invoice/PaymentProofForm";
import { remainingBalance } from "@/lib/paymentBalance";
import type { CurrencyCode, InvoiceStatus } from "@/types/invoice";

export default async function SharedInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_pdf_export_by_token", { p_token: token });
  const result = data?.[0];

  if (!result) {
    return (
      <div className="mx-auto max-w-sm px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-foreground">Link expired</h1>
        <p className="mt-2 text-sm text-muted">
          This shared invoice is no longer available — the sender may have set it to expire, or it&apos;s already gone.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-bold text-accent hover:text-accent-hover">
          Go to Invoice Generator
        </Link>
      </div>
    );
  }

  const pdfUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/invoice-pdfs/${result.storage_path}`;

  let remaining = 0;
  let currency: CurrencyCode = "INR";
  if (result.invoice_id) {
    const { data: summaryRows } = await supabase.rpc("get_public_invoice_summary", { p_invoice_id: result.invoice_id });
    const summary = summaryRows?.[0];
    if (summary) {
      currency = summary.currency as CurrencyCode;
      remaining = remainingBalance(summary.status as InvoiceStatus, summary.total, summary.paid_amount ?? 0);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-24 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-soft text-accent">
        <FileText className="h-7 w-7" />
      </span>
      <h1 className="mt-6 font-display text-2xl font-extrabold text-foreground">
        Invoice {result.invoice_number}
      </h1>
      {result.business_name && <p className="mt-1 text-sm text-muted">from {result.business_name}</p>}
      <a
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-foreground shadow-[0_10px_22px_rgba(0,169,124,0.32)] hover:bg-accent-hover"
      >
        <Download className="h-4 w-4" /> Download PDF
      </a>

      {result.invoice_id && (
        <PaymentProofForm
          invoiceId={result.invoice_id}
          initialStatus={result.invoice_status ?? "sent"}
          remainingBalance={remaining}
          currency={currency}
        />
      )}

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
