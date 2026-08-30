import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { InvoiceEditor } from "@/components/invoice/InvoiceEditor";

export const metadata: Metadata = {
  title: "Create Invoice",
  description: "Build a professional invoice with live preview, GST support, and instant PDF download.",
};

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[60vh] items-center justify-center text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <InvoiceEditor />
    </Suspense>
  );
}
