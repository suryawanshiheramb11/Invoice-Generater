"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Save, Trash2 } from "lucide-react";
import type { Invoice } from "@/types/invoice";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { validateInvoice } from "@/lib/validation";
import { listPdfExports, saveInvoicePdf, deletePdfExport } from "@/services/pdfExports";
import type { PdfExport, PdfRetention } from "@/services/pdfExports";

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h left`;
  return `${Math.round(hours / 24)}d left`;
}

export function PdfHistorySection({ invoice, qrDataUrl }: { invoice: Invoice; qrDataUrl: string | null }) {
  const { show } = useToast();
  const [exports, setExports] = useState<PdfExport[]>([]);
  const [loading, setLoading] = useState(!!invoice.id);
  const [saving, setSaving] = useState<PdfRetention | null>(null);

  useEffect(() => {
    if (!invoice.id) return;
    let cancelled = false;
    listPdfExports(invoice.id)
      .then((rows) => {
        if (!cancelled) setExports(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoice.id]);

  async function handleSave(retention: PdfRetention) {
    const errors = validateInvoice(invoice);
    if (errors.length > 0) {
      show(errors[0], "error");
      return;
    }
    setSaving(retention);
    try {
      const created = await saveInvoicePdf(invoice, qrDataUrl, retention);
      setExports((prev) => [created, ...prev]);
      await navigator.clipboard.writeText(created.shareUrl).catch(() => {});
      show("PDF saved and link copied to clipboard.", "success");
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setSaving(null);
    }
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url).catch(() => {});
    show("Link copied.", "success");
  }

  async function handleDelete(item: PdfExport) {
    try {
      await deletePdfExport(item.id, item.storagePath);
      setExports((prev) => prev.filter((e) => e.id !== item.id));
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    }
  }

  if (!invoice.id) {
    return <p className="text-sm text-muted">Save the invoice first to create shareable PDF links.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Save a shareable PDF</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" loading={saving === "24h"} onClick={() => handleSave("24h")}>
            <Save className="h-3.5 w-3.5" /> Save (24 hours)
          </Button>
          <Button type="button" variant="outline" size="sm" loading={saving === "7d"} onClick={() => handleSave("7d")}>
            <Save className="h-3.5 w-3.5" /> Save (7 days)
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted">Anyone with the link can view and download the PDF until it expires.</p>
      </div>

      {loading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading saved PDFs…
        </p>
      ) : exports.length > 0 ? (
        <div className="space-y-2">
          {exports.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-2xl bg-[#F9FBF9] px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-foreground">{item.shareUrl}</p>
                <p className="text-xs text-muted">{timeUntil(item.expiresAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(item.shareUrl)} aria-label="Copy link">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item)}
                  aria-label="Delete saved PDF"
                  className="text-danger hover:bg-danger-soft"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No saved PDFs yet.</p>
      )}
    </div>
  );
}
