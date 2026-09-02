"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import type { Invoice } from "@/types/invoice";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { displayStatus, STATUS_LABELS, STATUS_TONE } from "@/lib/invoiceStatus";
import { formatDate } from "@/lib/dates";
import {
  listPaymentProofs,
  getPaymentProofUrl,
  deletePaymentProof,
  PAYMENT_METHOD_LABELS,
} from "@/services/paymentProofs";
import type { PaymentProof } from "@/services/paymentProofs";

export function PaymentProofSection({ invoice }: { invoice: Invoice }) {
  const { show } = useToast();
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(!!invoice.id);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice.id) return;
    let cancelled = false;
    listPaymentProofs(invoice.id)
      .then((rows) => {
        if (!cancelled) setProofs(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoice.id]);

  async function handleView(proof: PaymentProof) {
    setOpeningId(proof.id);
    try {
      const url = await getPaymentProofUrl(proof.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete(proof: PaymentProof) {
    try {
      await deletePaymentProof(proof.id, proof.storagePath);
      setProofs((prev) => prev.filter((p) => p.id !== proof.id));
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    }
  }

  if (!invoice.id) {
    return <p className="text-sm text-muted">Save the invoice first — payment proofs attach to a saved invoice.</p>;
  }

  const status = displayStatus(invoice);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Current status</p>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
      </div>
      <p className="text-xs text-muted">
        When you save a shareable PDF link (above) and send it, the client can mark the invoice paid and attach a
        screenshot of the transfer, UPI confirmation, or receipt right from that page — no login needed on their end.
      </p>

      {loading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading payment proofs…
        </p>
      ) : proofs.length > 0 ? (
        <div className="space-y-2">
          {proofs.map((proof) => (
            <div key={proof.id} className="flex items-center justify-between gap-2 rounded-2xl bg-[#F9FBF9] px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground">{PAYMENT_METHOD_LABELS[proof.method]}</p>
                <p className="truncate text-xs text-muted">
                  {formatDate(proof.submittedAt, "DD MMM YYYY")}
                  {proof.note ? ` — ${proof.note}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleView(proof)}
                  loading={openingId === proof.id}
                  aria-label="View proof"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(proof)}
                  aria-label="Delete proof"
                  className="text-danger hover:bg-danger-soft"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No payment proof submitted yet.</p>
      )}
    </div>
  );
}
