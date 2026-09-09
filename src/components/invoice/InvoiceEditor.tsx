"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, Loader2, Printer, Save, Share2, Copy } from "lucide-react";
import type { Invoice, InvoiceStatus, TemplateId } from "@/types/invoice";
import { EditorSection } from "@/components/invoice/EditorSection";
import { BusinessSection } from "@/components/invoice/BusinessSection";
import { CustomerSection } from "@/components/invoice/CustomerSection";
import { InvoiceInfoSection } from "@/components/invoice/InvoiceInfoSection";
import { ItemsSection } from "@/components/invoice/ItemsSection";
import { TotalsSection } from "@/components/invoice/TotalsSection";
import { NotesSection } from "@/components/invoice/NotesSection";
import { PaymentInfoSection } from "@/components/invoice/PaymentInfoSection";
import { CustomizationSection } from "@/components/invoice/CustomizationSection";
import { PdfHistorySection } from "@/components/invoice/PdfHistorySection";
import { PaymentProofSection } from "@/components/invoice/PaymentProofSection";
import { InvoicePreview } from "@/components/invoice/InvoicePreview";
import { InvoiceScaleFrame } from "@/components/invoice/InvoiceScaleFrame";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";
import { useDebouncedEffect } from "@/hooks/useDebouncedEffect";
import { useQrDataUrl } from "@/hooks/useQrDataUrl";
import { createEmptyInvoice } from "@/lib/defaults";
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
  // Guards the "build a blank invoice" effect below so it can only ever run once.
  const initializedInvoice = useRef(Boolean(initialInvoice));
  // Signature of the untouched blank invoice, so a late-arriving guest draft can tell
  // "nothing typed yet" from "don't clobber what's on screen".
  const pristineSignature = useRef<string | null>(null);
  // Whether a save is currently in flight, so two overlapping upserts can't race.
  const saveInFlight = useRef(false);

  /**
   * A saved invoice stops being editable the moment it leaves draft — once it's been sent,
   * the client is holding a copy, and silently editing the record behind that copy is how
   * an invoice and the PDF someone actually received drift apart. Duplicate is the way to
   * make changes: it opens a fresh draft with a new number.
   *
   * This is a workflow guard, not a security boundary — it's the owner's own row, and RLS
   * lets them update it. It stops the accident, not a determined owner with an API client.
   */
  const locked = Boolean(invoiceId) && Boolean(invoice) && invoice!.status !== "draft";

  // Drives the mobile-only action bar: on a phone the preview sits below the whole editor,
  // so once someone has scrolled down to look at the invoice itself, the toolbar with
  // Share/Download is far off-screen above them.
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewInView, setPreviewInView] = useState(false);
  const editorReady = Boolean(invoice) && !userLoading;
  useEffect(() => {
    const node = previewRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setPreviewInView(entry.isIntersecting), {
      threshold: 0.04,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [editorReady]);

  // Step 1: paint the form immediately, with no network on the critical path.
  //
  // This used to await getNextInvoiceNumber() before rendering anything, which for a
  // signed-in user meant three sequential Supabase round trips behind a spinner —
  // useUser()'s getUser(), then getUser() *again* inside getNextInvoiceNumber(), then the
  // next_invoice_number RPC. On a slow link that's seconds of blank page. The real number
  // is a two-field detail; there's no reason to hold the whole editor hostage to it, so it
  // starts as a local placeholder and gets patched in by step 2 below.
  //
  // The once-only guard is also load-bearing: `user` is a fresh object on every Supabase
  // auth event (token refresh, tab refocus), and this effect re-running used to reset the
  // whole invoice — the "my data vanished while typing" bug.
  useEffect(() => {
    if (invoiceId || initialInvoice || initializedInvoice.current) return;
    initializedInvoice.current = true;
    const fresh = createEmptyInvoice(`INV-${new Date().getFullYear()}-0001`);
    if (templateParam && templateParam in TEMPLATES) fresh.template = templateParam;
    pristineSignature.current = invoiceSignature(fresh);
    setInvoice(fresh);
  }, [invoiceId, initialInvoice, templateParam]);

  // Step 2: once auth resolves, fill in the parts that genuinely needed the network.
  // Keyed by user id so a token refresh (same id) doesn't redo the work, while an actual
  // guest -> signed-in transition does: the guest placeholder number may already be taken
  // on the account they just signed into, and would collide on (user_id, invoice_number).
  const hydratedFor = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (invoiceId || initialInvoice || userLoading) return;
    const key = user?.id ?? null;
    if (hydratedFor.current === key) return;
    const firstResolution = hydratedFor.current === undefined;
    hydratedFor.current = key;

    if (!key) {
      // Guests resume their local draft — but only over an untouched form, never on top of
      // something they've already started typing.
      if (!firstResolution) return;
      const draft = loadDraft();
      if (draft) {
        setInvoice((prev) => (prev && invoiceSignature(prev) === pristineSignature.current ? draft : prev));
      }
      return;
    }

    getNextInvoiceNumber()
      .then((number) => setInvoice((prev) => (prev && !prev.id ? { ...prev, invoiceNumber: number } : prev)))
      .catch(() => {});
  }, [user, userLoading, invoiceId, initialInvoice]);

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
        // Re-check at apply time, not just at request time: the form is interactive while
        // this is in flight now, so the user may have typed their own business details in
        // the meantime — those win.
        if (profile) setInvoice((prev) => (prev && !prev.business.name ? { ...prev, business: profile } : prev));
      })
      .catch(() => {});
  }, [user, invoiceId, invoice]);

  const update = useCallback((patch: Partial<Invoice>) => {
    setInvoice((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  // Stable identity so PaymentProofSection's status-watching effect only fires on a real
  // status change, not on every render of this component.
  const handleStatusChange = useCallback((status: InvoiceStatus) => update({ status }), [update]);

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
      if (!invoice || !user || locked) return;
      if (invoiceSignature(invoice) === lastSavedSignature.current) return;
      if (validateInvoice(invoice).length > 0) return;
      void persist(true);
    },
    [invoice, user, locked],
    2000
  );

  async function persist(silent = false) {
    if (!invoice) return;
    if (!user) {
      show("Create a free account to save invoices permanently.", "info");
      return;
    }
    if (locked) {
      if (!silent) show("This invoice was already sent — duplicate it to make changes.", "info");
      return;
    }
    const errors = validateInvoice(invoice);
    if (errors.length > 0) {
      if (!silent) show(errors[0], "error");
      return;
    }
    // Two upserts in flight at once (manual Save landing on top of an autosave, say) would
    // race to decide which version wins.
    if (saveInFlight.current) return;
    saveInFlight.current = true;

    // What we're actually sending. Typing continues during the round trip, so this is not
    // necessarily what's on screen by the time the save resolves.
    const snapshot = invoice;
    const snapshotSignature = invoiceSignature(snapshot);
    setSaving(true);
    try {
      const saved = await saveInvoice(snapshot);
      lastSavedSignature.current = invoiceSignature(saved);
      setInvoice((current) => {
        if (!current || invoiceSignature(current) === snapshotSignature) return saved;
        // The invoice changed while the save was in flight. Blindly assigning the server's
        // response here would throw away every keystroke made during the round trip — the
        // second half of the "my data disappeared" bug, and the nastier half, because it
        // also marked that lost text as saved. Keep what's on screen; take only the fields
        // the server owns. The autosave effect then fires again for the newer content,
        // since it no longer matches lastSavedSignature.
        return {
          ...current,
          id: saved.id,
          userId: saved.userId,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        };
      });
      setLastSavedAt(new Date());
      clearDraft();
      if (!silent) show("Invoice saved.", "success");
      if (!invoiceId) router.replace(`/invoice/${saved.id}`);
    } catch (err) {
      if (!silent) show(friendlyErrorMessage(err), "error");
    } finally {
      saveInFlight.current = false;
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

  // Deliberately not gated on userLoading: the form is fully usable before we know who's
  // signed in (that only decides where it saves), and waiting on the auth round trip here
  // was the last thing keeping a spinner on screen for no good reason.
  if (!invoice) {
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
            {locked
              ? "Sent — locked to match what your client received."
              : userLoading
                ? // The form renders before auth resolves, so don't flash "editing as guest"
                  // at someone who is in fact signed in.
                  "Changes autosave once required fields are filled."
                : user
                  ? saving
                  ? "Saving…"
                  : lastSavedAt
                    ? `Saved at ${lastSavedAt.toLocaleTimeString()}`
                    : "Changes autosave once required fields are filled."
                : "Editing as guest — sign in to save permanently."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {locked ? null : user ? (
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
        <div className="no-print min-w-0 space-y-4">
          {locked && (
            <div className="rounded-[22px] border-[1.6px] border-warning bg-warning-soft px-5 py-4">
              <p className="text-sm font-bold text-foreground">This invoice has been sent</p>
              <p className="mt-1 text-xs text-muted">
                Its details are locked so they keep matching the copy your client received. Payment status and proof
                below can still be updated. To change anything else, use{" "}
                <span className="font-bold text-foreground">Duplicate</span> — it opens an editable copy with a new
                invoice number.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleDuplicate}>
                <Copy className="h-3.5 w-3.5" /> Duplicate to edit
              </Button>
            </div>
          )}

          <EditorSection title="Your Business" subtitle="Appears on every invoice you create." disabled={locked}>
            <BusinessSection business={invoice.business} onChange={(patch) => update({ business: { ...invoice.business, ...patch } })} />
          </EditorSection>

          <EditorSection title="Bill To" disabled={locked}>
            <CustomerSection
              customer={invoice.customer}
              shipping={invoice.shipping}
              onCustomerChange={(patch) => update({ customer: { ...invoice.customer, ...patch } })}
              onShippingChange={(patch) => update({ shipping: { ...invoice.shipping, ...patch } })}
            />
          </EditorSection>

          <EditorSection title="Invoice Information" disabled={locked}>
            <InvoiceInfoSection
              invoiceNumber={invoice.invoiceNumber}
              invoiceDate={invoice.invoiceDate}
              dueDate={invoice.dueDate}
              paymentTerm={invoice.paymentTerm}
              currency={invoice.currency}
              onChange={update}
            />
          </EditorSection>

          <EditorSection title="Invoice Items" disabled={locked}>
            <ItemsSection
              items={invoice.items}
              currency={invoice.currency}
              taxMode={invoice.taxMode}
              showTax={invoice.customization.showTaxColumn}
              showDiscount={invoice.customization.showDiscountColumn}
              onChange={(items) => update({ items })}
            />
          </EditorSection>

          <EditorSection title="Taxes & Totals" disabled={locked}>
            <TotalsSection invoice={invoice} onChange={update} />
          </EditorSection>

          <EditorSection title="Notes & Terms" defaultOpen={false} disabled={locked}>
            <NotesSection
              notes={invoice.notes}
              terms={invoice.terms}
              paymentInstructions={invoice.paymentInstructions}
              onChange={update}
            />
          </EditorSection>

          <EditorSection title="Payment Information" defaultOpen={false} disabled={locked}>
            <PaymentInfoSection paymentInfo={invoice.paymentInfo} onChange={(patch) => update({ paymentInfo: { ...invoice.paymentInfo, ...patch } })} />
          </EditorSection>

          <EditorSection title="Template & Customization" defaultOpen={false} disabled={locked}>
            <CustomizationSection
              template={invoice.template}
              customization={invoice.customization}
              onTemplateChange={(template: TemplateId) => update({ template })}
              onChange={(patch) => update({ customization: { ...invoice.customization, ...patch } })}
            />
          </EditorSection>

          {user && invoiceId && (
            <EditorSection title="Share PDF" subtitle="Save a snapshot others can view via a link." defaultOpen={false}>
              <PdfHistorySection invoice={invoice} qrDataUrl={qrDataUrl} />
            </EditorSection>
          )}

          {user && invoiceId && (
            <EditorSection title="Payment Status" subtitle="Track payment proof your client submits." defaultOpen={false}>
              <PaymentProofSection invoice={invoice} onStatusChange={handleStatusChange} />
            </EditorSection>
          )}
        </div>

        {/* Live preview */}
        <div ref={previewRef} className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[22px] bg-black/[0.02] p-4">
            <InvoiceScaleFrame>
              <InvoicePreview invoice={invoice} />
            </InvoiceScaleFrame>
          </div>
          {/* Room for the fixed mobile bar below, so it never covers the end of the invoice. */}
          <div aria-hidden className="h-20 lg:hidden" />
        </div>
      </div>

      {/* Mobile-only: once the invoice preview is on screen, put Share/Download within
          thumb reach instead of back up at the top of the page. */}
      {previewInView && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md gap-2 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
            <Button className="flex-1" onClick={handleSharePdf} loading={sharing}>
              <Share2 className="h-4 w-4" /> Share PDF
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDownloadPdf} loading={downloading}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
