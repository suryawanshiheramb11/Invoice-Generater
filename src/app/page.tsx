import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Download,
  FileStack,
  Globe2,
  Printer,
  Save,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TemplateShowcase } from "@/components/landing/TemplateShowcase";
import { Faq } from "@/components/landing/Faq";

const steps = [
  {
    title: "Enter your details",
    description: "Add your business info, customer details, and invoice items — or start from demo data.",
  },
  {
    title: "Customize your invoice",
    description: "Pick a template, currency, accent color, and configure GST or simple tax in seconds.",
  },
  {
    title: "Print or download",
    description: "Get a print-ready A4 invoice or a polished PDF — no software to install.",
  },
];

const features = [
  { icon: Sparkles, title: "Instant invoice creation", description: "Live preview updates as you type — no page reloads." },
  { icon: FileStack, title: "Professional templates", description: "Classic, Modern, Minimal, Business, and GST-ready layouts." },
  { icon: Banknote, title: "GST support", description: "CGST/SGST/IGST built in, plus a simple single-tax mode." },
  { icon: Globe2, title: "Multiple currencies", description: "INR, USD, EUR, GBP, AED, CAD, AUD, SGD, and JPY." },
  { icon: Download, title: "PDF download", description: "Selectable-text PDFs that match your preview exactly." },
  { icon: Printer, title: "Print-ready invoices", description: "Dedicated print styles fit perfectly on A4 paper." },
  { icon: Save, title: "Saved invoices", description: "Your invoices, always available in your dashboard." },
  { icon: Users, title: "Customer management", description: "Save customers once, reuse them on every invoice." },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Free to use, no signup required
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Create Professional Invoices in Seconds
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted">
            Create, customize, print, and download professional invoices online — no complicated
            software required.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/invoice/new">
              <Button size="lg" className="w-full sm:w-auto">
                Create Invoice <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">How It Works</h2>
          <p className="mt-3 text-muted">From a blank page to a finished invoice in three simple steps.</p>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="relative rounded-xl border border-border bg-surface p-6">
              <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {i + 1}
              </span>
              <h3 className="text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Everything you need to bill clients</h2>
            <p className="mt-3 text-muted">Built for freelancers, agencies, and small businesses.</p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-background p-5">
                <f.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Professional invoice templates</h2>
          <p className="mt-3 text-muted">Switch anytime without losing your invoice data.</p>
        </div>
        <TemplateShowcase />
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
          <Faq />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight">Create Your First Invoice</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          It takes less than a minute to generate a professional, print-ready invoice.
        </p>
        <div className="mt-8">
          <Link href="/invoice/new">
            <Button size="lg">
              Create Invoice <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
