"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, Loader2, Printer, Save, Share2, Sparkles, Copy } from "lucide-react";
import type { Invoice, TemplateId } from "@/types/invoice";
import { EditorSection } from "@/components/invoice/EditorSection";
import { BusinessSection } from "@/components/invoice/BusinessSection";
import { CustomerSection } from "@/components/invoice/CustomerSection";
import { InvoiceInfoSection } from "@/components/invoice/InvoiceInfoSection";
import { ItemsSection } from "@/components/invoice/ItemsSection";
import { TotalsSection } from "@/components/invoice/TotalsSection";
import { NotesSection } from "@/components/invoice/NotesSection";
import { PaymentInfoSection } from "@/components/invoice/PaymentInfoSection";
import { CustomizationSection } from "@/components/invoice/CustomizationSection";
import { InvoicePreview } from "@/components/invoice/InvoicePreview";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { useQrDataUrl } from "@/hooks/useQrDataUrl";
import { createDemoInvoice, createEmptyInvoice } from "@/lib/defaults";
import { TEMPLATES } from "@/lib/templates";
import { saveDraft, loadDraft, clearDraft } from "@/lib/guestStorage";
import { validateInvoice } from "@/lib/validation";
import { friendlyErrorMessage } from "@/lib/errors";
import { getNextInvoiceNumber, prepareDuplicateInvoice, saveInvoice } from "@/services/invoices";
import { getBusinessProfile } from "@/services/profile";
import { buildUpiUri } from "@/lib/upi";
import { calculateInvoiceTotals } from "@/lib/calculations";

/** Content-only signature, excluding server-set fields that change on every save. */
function invoiceSignature(invoice: Invoice): string {
  const rest: Partial<Invoice> = { ...invoice };
  delete rest.updatedAt;
  delete rest.createdAt;
  return JSON.stringify(rest);
}

export function InvoiceEditor({ invoiceId, initialInvoice }: { invoiceId?: string; initialInvoice?: Invoice }) {
  const { user, loading: userLoading } = useUser();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template") as TemplateId | null;

  const [invoice, setInvoice] = useState<Invoice | null>(initialInvoice ?? null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const initializedProfile = useRef(false);
  // Tracks the content we last persisted (excluding server-set fields like updatedAt,
  // which change on every save and would otherwise make the object look "edited" again
  // as soon as setInvoice(saved) runs, re-triggering the autosave effect in a loop).
  const lastSavedSignature = useRef<string | null>(initialInvoice ? invoiceSignature(initialInvoice) : null);

  // Initialize a new invoice. Guests resume their local draft (if any); signed-in users
  // always start fresh here (their existing invoices live in the dashboard) — otherwise a
  // stale guest draft from before they logged in could reload with an invoice number that's
  // already saved under their account and collide on save.
  useEffect(() => {
    if (invoiceId || initialInvoice || userLoading) return;
    let cancelled = false;
    (async () => {
      if (!user) {
        const draft = loadDraft();
        if (draft) {
          if (!cancelled) setInvoice(draft);
          return;
        }
      }
      const number = await getNextInvoiceNumber().catch(() => `INV-${new Date().getFullYear()}-0001`);
      const fresh = createEmptyInvoice(number);
      if (templateParam && templateParam in TEMPLATES) fresh.template = templateParam;
      if (!cancelled) setInvoice(fresh);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, userLoading, user]);

  // Pre-fill saved business profile once, for logged-in users starting a new invoice.
  useEffect(() => {
    if (!user || invoiceId || initializedProfile.current || !invoice) return;
    if (invoice.business.name) {
      initializedProfile.current = true;
      return;
    }
    initializedProfile.current = true;
    getBusinessProfile()
      .then((profile) => {
        if (profile) setInvoice((prev) => (prev ? { ...prev, business: profile } : prev));
      })
      .catch(() => {});
  }, [user, invoiceId, invoice]);

  const update = useCallback((patch: Partial<Invoice>) => {
    setInvoice((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Guest autosave to localStorage.
  useDebouncedEffect(
    () => {
      if (!invoice || user) return;
      saveDraft(invoice);
    },
    [invoice, user],
    600
  );

  // Authenticated autosave to the database (only once the invoice is reasonably complete,
  // and only if the content actually changed since the last save — persist() below writes
  // back a fresh `updatedAt` from the DB, which must not itself look like a new edit).
  useDebouncedEffect(
    () => {
      if (!invoice || !user) return;
      if (invoiceSignature(invoice) === lastSavedSignature.current) return;
      if (validateInvoice(invoice).length > 0) return;
      void persist(true);
    },
    [invoice, user],
    2000
  );

  async function persist(silent = false) {
    if (!invoice) return;
    if (!user) {
      show("Create a free account to save invoices permanently.", "info");
      return;
    }
    const errors = validateInvoice(invoice);
    if (errors.length > 0) {
      if (!silent) show(errors[0], "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveInvoice(invoice);
      lastSavedSignature.current = invoiceSignature(saved);
      setInvoice(saved);
      setLastSavedAt(new Date());
      clearDraft();
      if (!silent) show("Invoice saved.", "success");
      if (!invoiceId) router.replace(`/invoice/${saved.id}`);
    } catch (err) {
      if (!silent) show(friendlyErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    if (!invoice) return;
    if (!user) {
      show("Sign in to duplicate invoices.", "info");
      return;
    }
    try {
      const copy = await prepareDuplicateInvoice(invoice);
      setInvoice(copy);
      router.replace("/invoice/new");
      show("Duplicated. Editing a new copy.", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to duplicate invoice.", "error");
    }
  }

  function handlePrint() {
    if (!invoice) return;
    const errors = validateInvoice(invoice);
    if (errors.length > 0) {
      show(errors[0], "error");
      return;
    }
    window.print();
  }

  const totals = invoice ? calculateInvoiceTotals(invoice) : null;
  const upiUri =
    invoice && invoice.paymentInfo.showQrCode && totals
      ? buildUpiUri(invoice.paymentInfo, invoice.business.name, totals.total, invoice.currency, invoice.invoiceNumber)
      : null;
  const qrDataUrl = useQrDataUrl(upiUri);

  async function handleDownloadPdf() {
    if (!invoice) return;
    const errors = validateInvoice(invoice);
    if (errors.length > 0) {
      show(errors[0], "error");
      return;
    }
    setDownloading(true);
    try {
      const { downloadInvoicePdf } = await import("@/lib/pdf");
      await downloadInvoicePdf(invoice, qrDataUrl);
    } catch {
      show("PDF generation failed. Please try again.", "error");
    } finally {
      setDownloading(false);
    }
  }

  async function handleSharePdf() {
    if (!invoice) return;
    const errors = validateInvoice(invoice);
    if (errors.length > 0) {
      show(errors[0], "error");
      return;
    }
    setSharing(true);
    try {
      const { shareInvoicePdf } = await import("@/lib/pdf");
      const result = await shareInvoicePdf(invoice, qrDataUrl);
      if (result === "downloaded") {
        show("Sharing isn't supported in this browser — downloaded the PDF instead.", "info");
      }
    } catch {
      show("Couldn't share the PDF. Please try again.", "error");
    } finally {
      setSharing(false);
    }
  }

  function loadDemo() {
    if (!invoice) return;
    setInvoice(createDemoInvoice(invoice.invoiceNumber));
  }

  if (!invoice || userLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-7 sm:px-8 lg:px-10">
      <div className="no-print mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            {invoiceId ? "Edit invoice" : "New invoice"}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-muted">
            {user
              ? saving
                ? "Saving…"
                : lastSavedAt
                  ? `Saved at ${lastSavedAt.toLocaleTimeString()}`
                  : "Changes autosave once required fields are filled."
              : "Editing as guest — sign in to save permanently."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!invoiceId && (
            <Button variant="ghost" size="sm" onClick={loadDemo}>
              <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Load demo data</span>
            </Button>
          )}
          {invoiceId && (
            <Button variant="outline" size="sm" onClick={handleDuplicate}>
              <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Duplicate</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Print Invoice</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleSharePdf} loading={sharing}>
            <Share2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Share</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} loading={downloading}>
            <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Download PDF</span>
          </Button>
          {user ? (
            <Button size="sm" onClick={() => persist(false)} loading={saving}>
              <Save className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Save Invoice</span>
            </Button>
          ) : (
            <Link href="/signup">
              <Button size="sm">
                <Save className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign up to save</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        {/* Editor */}
        <div className="no-print space-y-4">
          <EditorSection title="Your Business" subtitle="Appears on every invoice you create.">
            <BusinessSection business={invoice.business} onChange={(patch) => update({ business: { ...invoice.business, ...patch } })} />
          </EditorSection>

          <EditorSection title="Bill To">
            <CustomerSection
              customer={invoice.customer}
              shipping={invoice.shipping}
              onCustomerChange={(patch) => update({ customer: { ...invoice.customer, ...patch } })}
              onShippingChange={(patch) => update({ shipping: { ...invoice.shipping, ...patch } })}
            />
          </EditorSection>

          <EditorSection title="Invoice Information">
            <InvoiceInfoSection
              invoiceNumber={invoice.invoiceNumber}
              invoiceDate={invoice.invoiceDate}
              dueDate={invoice.dueDate}
              paymentTerm={invoice.paymentTerm}
              currency={invoice.currency}
              onChange={update}
            />
          </EditorSection>

          <EditorSection title="Invoice Items">
            <ItemsSection
              items={invoice.items}
              currency={invoice.currency}
              taxMode={invoice.taxMode}
              showTax={invoice.customization.showTaxColumn}
              showDiscount={invoice.customization.showDiscountColumn}
              onChange={(items) => update({ items })}
            />
          </EditorSection>

          <EditorSection title="Taxes & Totals">
            <TotalsSection invoice={invoice} onChange={update} />
          </EditorSection>

          <EditorSection title="Notes & Terms" defaultOpen={false}>
            <NotesSection
              notes={invoice.notes}
              terms={invoice.terms}
              paymentInstructions={invoice.paymentInstructions}
              onChange={update}
            />
          </EditorSection>

          <EditorSection title="Payment Information" defaultOpen={false}>
            <PaymentInfoSection paymentInfo={invoice.paymentInfo} onChange={(patch) => update({ paymentInfo: { ...invoice.paymentInfo, ...patch } })} />
          </EditorSection>

          <EditorSection title="Template & Customization" defaultOpen={false}>
            <CustomizationSection
              template={invoice.template}
              customization={invoice.customization}
              onTemplateChange={(template: TemplateId) => update({ template })}
              onChange={(patch) => update({ customization: { ...invoice.customization, ...patch } })}
            />
          </EditorSection>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-x-auto rounded-[22px] bg-black/[0.02] p-4">
            <InvoicePreview invoice={invoice} />
          </div>
        </div>
      </div>
    </div>
  );
}
