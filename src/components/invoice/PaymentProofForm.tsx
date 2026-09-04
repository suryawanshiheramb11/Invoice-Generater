"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";
import type { CurrencyCode } from "@/types/invoice";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { submitPaymentProof, PAYMENT_METHOD_LABELS } from "@/services/paymentProofs";
import type { PaymentMethod } from "@/services/paymentProofs";

const METHODS: PaymentMethod[] = ["upi", "bank_transfer", "cash", "card", "other"];
const AMOUNT_TOLERANCE = 0.01;

export function PaymentProofForm({
  invoiceId,
  initialStatus,
  remainingBalance,
  currency,
}: {
  invoiceId: string;
  initialStatus: string;
  /** What's still owed right now — also what an advance/partial payment is capped against. */
  remainingBalance: number;
  currency: CurrencyCode;
}) {
  const { show } = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [note, setNote] = useState("");
  const [amountInput, setAmountInput] = useState(() => (remainingBalance > 0 ? String(remainingBalance) : ""));
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const amount = parseFloat(amountInput);
  const validAmount = Number.isFinite(amount) && amount > 0;
  // Paying anything short of the full remaining balance — whether that's an advance before
  // work starts or the tail end of a payment plan — is a partial payment either way.
  const partial = validAmount && amount < remainingBalance - AMOUNT_TOLERANCE;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      show("Attach a screenshot or photo of the payment first.", "error");
      return;
    }
    if (!validAmount) {
      show("Enter how much you're paying.", "error");
      return;
    }
    if (amount > remainingBalance + AMOUNT_TOLERANCE) {
      show(`That's more than the remaining balance of ${formatMoney(remainingBalance, currency)}.`, "error");
      return;
    }
    setSubmitting(true);
    try {
      await submitPaymentProof({ invoiceId, file, method, note, partial, amount });
      setStatus(partial ? "partially_paid" : "paid");
      setJustSubmitted(true);
      show("Thanks — payment recorded.", "success");
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "paid") {
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
          {justSubmitted
            ? "Thanks — that's on record and awaiting the sender's confirmation. The remaining balance below will update once they confirm it."
            : `A partial payment is on record. Confirmed remaining balance: ${formatMoney(remainingBalance, currency)}.`}
        </p>
      )}
      <p className="mb-3 text-sm font-bold text-foreground">Already paid (or paying an advance)? Let the sender know</p>
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

        <Field
          label="Amount you're paying"
          required
          hint={`Remaining balance: ${formatMoney(remainingBalance, currency)}. Pay less than the full amount for an advance or partial payment.`}
        >
          <Input
            type="number"
            min={0.01}
            max={remainingBalance || undefined}
            step="0.01"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
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

        <Button type="submit" className="w-full" loading={submitting}>
          {partial ? "Submit partial payment" : "Mark as paid"}
        </Button>
      </form>
    </div>
  );
}
