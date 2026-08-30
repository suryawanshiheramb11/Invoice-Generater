import type { Metadata } from "next";
import { TemplateShowcase } from "@/components/landing/TemplateShowcase";

export const metadata: Metadata = {
  title: "Invoice Templates",
  description: "Browse Classic, Modern, Minimal, Business, and GST invoice templates.",
};

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Invoice Templates</h1>
        <p className="mt-3 text-muted">Pick a starting point — switch anytime without losing your invoice data.</p>
      </div>
      <TemplateShowcase />
    </div>
  );
}
