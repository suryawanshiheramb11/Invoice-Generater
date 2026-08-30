"use client";

import type { PaymentInfo } from "@/types/invoice";
import { Field, Input, Checkbox } from "@/components/ui/Field";

interface Props {
  paymentInfo: PaymentInfo;
  onChange: (patch: Partial<PaymentInfo>) => void;
}

export function PaymentInfoSection({ paymentInfo, onChange }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">All fields are optional. Payment processing is not required to create an invoice.</p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Bank Name">
          <Input value={paymentInfo.bankName} onChange={(e) => onChange({ bankName: e.target.value })} />
        </Field>
        <Field label="Account Holder">
          <Input value={paymentInfo.accountHolder} onChange={(e) => onChange({ accountHolder: e.target.value })} />
        </Field>
        <Field label="Account Number">
          <Input value={paymentInfo.accountNumber} onChange={(e) => onChange({ accountNumber: e.target.value })} />
        </Field>
        <Field label="IFSC">
          <Input value={paymentInfo.ifsc} onChange={(e) => onChange({ ifsc: e.target.value })} />
        </Field>
        <Field label="SWIFT">
          <Input value={paymentInfo.swift} onChange={(e) => onChange({ swift: e.target.value })} />
        </Field>
        <Field label="PayPal Email">
          <Input type="email" value={paymentInfo.paypalEmail} onChange={(e) => onChange({ paypalEmail: e.target.value })} />
        </Field>
      </div>

      <div className="rounded-2xl bg-[#F2F8F5] p-3.5">
        <Field label="UPI ID" hint="Prominently supported for Indian payments.">
          <Input value={paymentInfo.upiId} onChange={(e) => onChange({ upiId: e.target.value })} placeholder="yourname@bank" />
        </Field>
        {paymentInfo.upiId && (
          <label className="mt-2 flex items-center gap-2 text-xs">
            <Checkbox checked={paymentInfo.showQrCode} onChange={(e) => onChange({ showQrCode: e.target.checked })} />
            Generate a UPI QR code on the invoice
          </label>
        )}
      </div>

      <Field label="Payment Link">
        <Input value={paymentInfo.paymentLink} onChange={(e) => onChange({ paymentLink: e.target.value })} placeholder="https://..." />
      </Field>

      <Field label="Other Instructions">
        <Input value={paymentInfo.otherInstructions} onChange={(e) => onChange({ otherInstructions: e.target.value })} />
      </Field>
    </div>
  );
}
