"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const faqs = [
  {
    q: "Can I create invoices for free?",
    a: "Yes. You can create, preview, print, and download invoices without creating an account. Signing up is only needed to save invoices and access your dashboard.",
  },
  {
    q: "Can I download invoices as PDF?",
    a: "Yes. Every invoice can be downloaded as a professional, A4-formatted PDF with selectable text directly from the editor.",
  },
  {
    q: "Can I print invoices?",
    a: "Yes. The Print Invoice button opens your browser's print dialog with a dedicated print stylesheet that fits perfectly on A4 paper.",
  },
  {
    q: "Does it support GST?",
    a: "Yes. The GST template and tax mode support CGST, SGST, and IGST, alongside a simple single-tax-percentage option for non-GST invoices.",
  },
  {
    q: "Can I save invoices?",
    a: "Yes, once you create a free account. Saved invoices appear in your dashboard where you can edit, duplicate, or delete them.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. The invoice builder is fully responsive, and the printed/downloaded invoice always stays formatted for A4 regardless of your screen size.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-background">
      {faqs.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-foreground"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${i}`}
            >
              {item.q}
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div id={`faq-panel-${i}`} className="px-5 pb-4 text-sm text-muted">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
