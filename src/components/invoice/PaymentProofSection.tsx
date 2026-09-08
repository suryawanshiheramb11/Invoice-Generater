"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, Lock, RefreshCw, Trash2, X } from "lucide-react";
import type { CurrencyCode, Invoice, InvoiceStatus } from "@/types/invoice";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Field, Select, Textarea, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { displayStatus, STATUS_LABELS, STATUS_TONE } from "@/lib/invoiceStatus";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { calculateInvoiceTotals } from "@/lib/calculations";
import { remainingBalance } from "@/lib/paymentBalance";
import { updateInvoiceStatus } from "@/services/invoices";
import {
  listPaymentProofs,
  getPaymentProofUrl,
  deletePaymentProof,
  recordManualPayment,
  reviewPaymentProof,
  rerunVerification,
  syncPaymentStatus,
  PAYMENT_METHOD_LABELS,
} from "@/services/paymentProofs";
import type { PaymentMethod, PaymentProof } from "@/services/paymentProofs";

// Statuses an owner can manually pick from the dropdown below. Deliberately excludes
// "paid"/"partially_paid" — claiming an invoice is paid must always be backed by an actual
// proof (recorded via "Record a payment received offline", or a client submission the
// owner approves), never a bare status flip with nothing to show for it. "overdue" is
// excluded too — it's a derived display label (see displayStatus), never chosen directly.
const EDITABLE_STATUSES: InvoiceStatus[] = ["draft", "sent", "cancelled"];

const METHODS: PaymentMethod[] = ["cash", "bank_transfer", "upi", "card", "other"];

const AI_STATUS_LABEL: Record<PaymentProof["aiStatus"], string> = {
  pending: "OCR check pending",
  match: "OCR: amount matches",
  mismatch: "OCR: amount mismatch",
  error: "OCR: couldn't read image",
  not_applicable: "No file to check",
};
const AI_STATUS_TONE: Record<PaymentProof["aiStatus"], "default" | "success" | "warning" | "danger" | "accent"> = {
  pending: "warning",
  match: "success",
  mismatch: "danger",
  error: "danger",
  not_applicable: "default",
};

export function PaymentProofSection({
  invoice,
  onStatusChange,
}: {
  invoice: Invoice;
  /** Lets the editor react to a status change here — notably to lock a just-sent invoice. */
  onStatusChange?: (status: InvoiceStatus) => void;
}) {
  const { show } = useToast();
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(!!invoice.id);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);
  // Reset synchronously during render when the prop changes, rather than in an effect body
  // (see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [syncedStatusFor, setSyncedStatusFor] = useState(invoice.status);
  if (invoice.status !== syncedStatusFor) {
    setSyncedStatusFor(invoice.status);
    setStatus(invoice.status);
  }

  // Push status changes back up to the editor. Every path in here routes through setStatus,
  // so watching it once covers the dropdown, approve/reject, delete, and manual payments
  // without threading the callback through each handler. (The caller must pass a stable
  // callback — an inline arrow would re-fire this on every render.)
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  function refresh() {
    if (!invoice.id) return;
    return listPaymentProofs(invoice.id)
      .then((rows) => setProofs(rows))
      .catch(() => {});
  }

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
    if (!proof.storagePath) return;
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
      setProofs(proofs.filter((p) => p.id !== proof.id));
      // Recompute from what's left rather than just checking "is anything still backed" —
      // deleting one of two approved proofs (e.g. the cash leg of a cash+UPI payment)
      // must drop status from "paid" down to "partially_paid", not leave it standing.
      if (invoice.id && proof.ownerStatus === "approved") {
        const newStatus = await syncPaymentStatus(invoice.id);
        if (newStatus !== status) {
          setStatus(newStatus);
          show(
            newStatus === "sent"
              ? "Proof deleted — status reverted to Sent since nothing backs it up anymore."
              : "Proof deleted — status updated to reflect what's still on record.",
            "info"
          );
        }
      }
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    }
  }

  async function handleRecheck(proof: PaymentProof) {
    setBusyId(proof.id);
    try {
      await rerunVerification(proof.id);
      await refresh();
      show("Re-checked.", "success");
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReview(proof: PaymentProof, approve: boolean) {
    setBusyId(proof.id);
    try {
      const newStatus = await reviewPaymentProof({ proofId: proof.id, invoiceId: invoice.id!, approve });
      await refresh();
      setStatus(newStatus);
      show(
        approve
          ? newStatus === "paid"
            ? "Approved — the invoice is now fully paid."
            : "Approved — still awaiting the remaining balance."
          : "Rejected.",
        "success"
      );
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(newStatus: InvoiceStatus) {
    if (!invoice.id || newStatus === status) return;
    const previous = status;
    setStatus(newStatus);
    setStatusSaving(true);
    try {
      await updateInvoiceStatus(invoice.id, newStatus);
      show("Status updated.", "success");
    } catch (err) {
      setStatus(previous);
      show(friendlyErrorMessage(err), "error");
    } finally {
      setStatusSaving(false);
    }
  }

  if (!invoice.id) {
    return <p className="text-sm text-muted">Save the invoice first — payment proofs attach to a saved invoice.</p>;
  }

  // Locked from free-form status edits once a human (the owner, or the owner approving a
  // client's proof) has confirmed *any* payment — recordManualPayment and an approved
  // review both set owner_status "approved". This deliberately fires on a partial
  // approval too: once real money is on record, you shouldn't be able to flip the status
  // back to draft/cancelled from the dropdown and lose track of it.
  const verified = proofs.some((p) => p.ownerStatus === "approved");
  // A client's submission flips status to paid/partially_paid immediately, before any
  // review — while that's outstanding, the right action is Approve/Reject below, not the
  // free-form dropdown (which also can't express "paid" at all — see EDITABLE_STATUSES).
  const hasPendingClientProof = proofs.some((p) => p.recordedBy === "client" && p.ownerStatus === "pending");
  const editable = !verified && !hasPendingClientProof;
  const displayed = displayStatus({ status, dueDate: invoice.dueDate });
  const total = calculateInvoiceTotals(invoice).total;
  const approvedAmount = proofs
    .filter((p) => p.ownerStatus === "approved")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const remaining = remainingBalance(status, total, approvedAmount);
  // Separate from `verified` above: a $2000 cash payment approved against a $4000 total
  // shouldn't block recording the other $2000 paid by UPI or card — only stop offering
  // "record a payment" once approved proofs actually cover the full total.
  const fullyPaid = verified && remaining <= 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Current status</p>
        {editable ? (
          <div className="flex items-center gap-1.5">
            <Select
              value={EDITABLE_STATUSES.includes(status) ? status : "sent"}
              onChange={(e) => handleStatusChange(e.target.value as InvoiceStatus)}
              disabled={statusSaving}
              className="h-8 w-auto min-w-0 rounded-full px-3 text-xs"
            >
              {EDITABLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            {statusSaving && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Badge tone={STATUS_TONE[displayed]}>{STATUS_LABELS[displayed]}</Badge>
            {verified ? (
              <span
                className="flex items-center gap-1 text-[11px] font-bold text-muted"
                title={
                  fullyPaid
                    ? "Payment verified — reject or delete the approved proof below to unlock"
                    : "A payment is on record — reject or delete it below to unlock the status dropdown. You can still record more payments toward the remaining balance below."
                }
              >
                <Lock className="h-3 w-3" /> Locked
              </span>
            ) : (
              <span className="text-[11px] font-bold text-muted">Awaiting your review below</span>
            )}
          </div>
        )}
      </div>
      {remaining > 0 && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">Remaining balance</span>
          <span className="font-bold text-foreground">{formatMoney(remaining, invoice.currency)}</span>
        </div>
      )}
      {approvedAmount > 0 && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">Paid so far</span>
          <span className="font-bold text-success">{formatMoney(approvedAmount, invoice.currency)}</span>
        </div>
      )}
      <p className="text-xs text-muted">
        When you save a shareable PDF link (above) and send it, the client can mark the invoice paid and attach a
        screenshot of the transfer, UPI confirmation, or receipt right from that page — no login needed on their end.
        Every submitted proof is OCR-checked automatically, then still needs your approval below. The status stays
        editable until you approve a proof (or record one yourself) — approving locks it in.
      </p>

      {loading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading payment proofs…
        </p>
      ) : proofs.length > 0 ? (
        <div className="space-y-2">
          {proofs.map((proof) => (
            <div key={proof.id} className="rounded-2xl bg-[#F9FBF9] px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">
                    {PAYMENT_METHOD_LABELS[proof.method]}
                    {proof.recordedBy === "owner" && <span className="ml-1.5 font-normal text-muted">— recorded by you</span>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {formatDate(proof.submittedAt, "DD MMM YYYY")}
                    {proof.note ? ` — ${proof.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {proof.storagePath && (
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
                  )}
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

              {proof.recordedBy === "client" && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {proof.highPriority && (
                    <Badge tone="danger" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> High priority
                    </Badge>
                  )}
                  <Badge tone={AI_STATUS_TONE[proof.aiStatus]}>{AI_STATUS_LABEL[proof.aiStatus]}</Badge>
                  <Badge tone={proof.ownerStatus === "approved" ? "success" : proof.ownerStatus === "rejected" ? "danger" : "warning"}>
                    {proof.ownerStatus === "pending" ? "Awaiting your review" : proof.ownerStatus === "approved" ? "Approved" : "Rejected"}
                  </Badge>
                </div>
              )}

              {proof.aiNotes && <p className="mt-1.5 text-[11px] leading-snug text-muted">{proof.aiNotes}</p>}

              {proof.recordedBy === "client" && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {proof.ownerStatus === "pending" && (
                    <>
                      <Button type="button" size="sm" variant="outline" loading={busyId === proof.id} onClick={() => handleReview(proof, true)}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={busyId === proof.id}
                        onClick={() => handleReview(proof, false)}
                        className="text-danger hover:bg-danger-soft"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  {proof.storagePath && (
                    <Button type="button" size="sm" variant="ghost" loading={busyId === proof.id} onClick={() => handleRecheck(proof)}>
                      <RefreshCw className="h-3.5 w-3.5" /> Re-check
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No payment proof submitted yet.</p>
      )}

      {fullyPaid ? (
        <p className="text-xs text-muted">
          Payment is verified and the status is locked. The submitted proof stays available above — reject it or
          delete it to unlock the status again.
        </p>
      ) : hasPendingClientProof ? (
        <p className="text-xs text-muted">Review the submitted proof above (Approve or Reject) before recording anything else.</p>
      ) : (
        <ManualPaymentForm
          invoiceId={invoice.id}
          remainingBalance={remaining}
          currency={invoice.currency}
          onRecorded={async (newStatus) => {
            setStatus(newStatus);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function ManualPaymentForm({
  invoiceId,
  remainingBalance: remaining,
  currency,
  onRecorded,
}: {
  invoiceId: string;
  remainingBalance: number;
  currency: CurrencyCode;
  onRecorded: (status: InvoiceStatus) => void;
}) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [amountInput, setAmountInput] = useState(() => (remaining > 0 ? String(remaining) : ""));
  const [submitting, setSubmitting] = useState(false);

  const amount = parseFloat(amountInput);
  const validAmount = Number.isFinite(amount) && amount > 0;
  const partial = validAmount && amount < remaining - 0.01;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validAmount) {
      show("Enter how much was paid.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const newStatus = await recordManualPayment({ invoiceId, method, note, partial, amount });
      onRecorded(newStatus);
      show(newStatus === "paid" ? "Payment recorded — invoice is fully paid." : "Payment recorded.", "success");
      setNote("");
      setOpen(false);
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Record a payment received offline
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border-[1.6px] border-dashed border-border-strong p-3.5">
      <p className="text-xs font-bold text-foreground">Record a payment the client paid outside this app</p>
      <p className="text-xs text-muted">
        For cash, or a bank transfer the client never logged themselves — or an advance paid before you&apos;ve started
        the work. Marks the invoice paid (or partially paid) immediately — no OCR check, since there&apos;s no proof file.
      </p>
      <Field label="How was it paid?" required>
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount paid" required hint={`Remaining balance: ${formatMoney(remaining, currency)}. Enter less for an advance or partial payment.`}>
        <Input type="number" min={0.01} max={remaining || undefined} step="0.01" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} />
      </Field>
      <Field label="Note (optional)">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Cash received in person on delivery" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={submitting}>
          {partial ? "Record partial payment" : "Mark as paid"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
