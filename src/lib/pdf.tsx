import { pdf } from "@react-pdf/renderer";
import type { Invoice } from "@/types/invoice";
import { InvoicePdfDocument } from "@/components/invoice/InvoicePdfDocument";

/**
 * Renders the invoice to a PDF blob entirely in the browser (no server round-trip),
 * so it works identically after deployment without a headless-browser backend.
 */
async function generatePdfFile(invoice: Invoice, qrDataUrl: string | null) {
  const blob = await pdf(<InvoicePdfDocument invoice={invoice} qrDataUrl={qrDataUrl} />).toBlob();
  const filename = `${invoice.invoiceNumber || "invoice"}.pdf`;
  return new File([blob], filename, { type: "application/pdf" });
}

export async function downloadInvoicePdf(invoice: Invoice, qrDataUrl: string | null) {
  const file = await generatePdfFile(invoice, qrDataUrl);
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Shares the PDF itself via the native share sheet (works on mobile and on desktop
 * browsers/OSes that support file sharing). Falls back to a plain download when the
 * browser can't share files, since Web Share's file support isn't universal.
 */
export async function shareInvoicePdf(invoice: Invoice, qrDataUrl: string | null) {
  const file = await generatePdfFile(invoice, qrDataUrl);
  const shareData = {
    files: [file],
    title: `Invoice ${invoice.invoiceNumber}`,
    text: `Invoice ${invoice.invoiceNumber} from ${invoice.business.name || "our business"}`,
  };

  if (navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return "shared" as const;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled" as const;
      throw err;
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return "downloaded" as const;
}
