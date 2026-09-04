"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { submitPaymentProof, PAYMENT_METHOD_LABELS } from "@/services/paymentProofs";
import type { PaymentMethod } from "@/services/paymentProofs";

const METHODS: PaymentMethod[] = ["upi", "bank_transfer", "cash", "card", "other"];

export function PaymentProofForm({
  invoiceId,
  initialStatus,
}: {
  invoiceId: string;
  initialStatus: string;
}) {
  const { show } = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [note, setNote] = useState("");
  const [partial, setPartial] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      show("Attach a screenshot or photo of the payment first.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await submitPaymentProof({ invoiceId, file, method, note, partial });
      setStatus(partial ? "partially_paid" : "paid");
      setJustSubmitted(true);
      show("Thanks — payment recorded.", "success");
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "paid" && !partial) {
    return (
      <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl bg-success-soft px-5 py-6 text-center">
        <CheckCircle2 className="h-6 w-6 text-success" />
        <p className="text-sm font-bold text-foreground">Payment received</p>
        <p className="text-xs text-muted">
          {justSubmitted
            ? "Your proof was sent to the sender."
            : "This invoice has already been marked as paid."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl bg-[#F9FBF9] px-5 py-5 text-left">
      {status === "partially_paid" && (
        <p className="mb-3 rounded-xl bg-warning-soft px-3 py-2 text-xs font-bold text-warning">
          A partial payment is already on record. Submit again if you&apos;re paying the remaining balance.
        </p>
      )}
      <p className="mb-3 text-sm font-bold text-foreground">Already paid? Let the sender know</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="How did you pay?" required>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Proof of payment" required hint="Screenshot or photo of the transfer, UPI confirmation, or receipt. PNG, JPEG, WebP, or PDF, up to 10MB.">
          <label className="flex h-11 w-full cursor-pointer items-center gap-2 rounded-2xl border-[1.6px] border-dashed border-border-strong bg-surface px-4 text-sm font-medium text-muted hover:border-accent">
            <UploadCloud className="h-4 w-4 shrink-0" />
            <span className="truncate">{file ? file.name : "Choose a file…"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>

        <Field label="Note (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. Paid via GPay, ref #123456" />
        </Field>

        <label className="flex items-center gap-2 text-xs font-medium text-muted">
          <Checkbox checked={partial} onChange={(e) => setPartial(e.target.checked)} />
          This is a partial payment
        </label>

        <Button type="submit" className="w-full" loading={submitting}>
          Mark as paid
        </Button>
      </form>
    </div>
  );
}
