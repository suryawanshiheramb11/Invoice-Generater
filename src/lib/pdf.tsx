import { pdf } from "@react-pdf/renderer";
import type { Invoice } from "@/types/invoice";
import { InvoicePdfDocument } from "@/components/invoice/InvoicePdfDocument";

/**
 * Renders the invoice to a PDF blob entirely in the browser (no server round-trip),
 * so it works identically after deployment without a headless-browser backend.
 */
export async function downloadInvoicePdf(invoice: Invoice, qrDataUrl: string | null) {
  const blob = await pdf(<InvoicePdfDocument invoice={invoice} qrDataUrl={qrDataUrl} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${invoice.invoiceNumber || "invoice"}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
