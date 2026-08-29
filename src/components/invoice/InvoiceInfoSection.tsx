"use client";

import type { CurrencyCode, PaymentTerm } from "@/types/invoice";
import { Field, Input, Select } from "@/components/ui/Field";
import { CURRENCY_LIST } from "@/lib/money";
import { PAYMENT_TERM_LABELS, dueDateFromTerm } from "@/lib/dates";

interface Props {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerm: PaymentTerm;
  currency: CurrencyCode;
  onChange: (patch: {
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string;
    paymentTerm?: PaymentTerm;
    currency?: CurrencyCode;
  }) => void;
}

const PAYMENT_TERMS: PaymentTerm[] = ["due_on_receipt", "net_7", "net_15", "net_30", "net_45", "net_60", "custom"];

export function InvoiceInfoSection({ invoiceNumber, invoiceDate, dueDate, paymentTerm, currency, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Field label="Invoice Number" required hint="Auto-generated, but you can edit it.">
        <Input value={invoiceNumber} onChange={(e) => onChange({ invoiceNumber: e.target.value })} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Invoice Date" required>
          <Input
            type="date"
            value={invoiceDate}
            onChange={(e) => {
              const newDate = e.target.value;
              onChange({ invoiceDate: newDate, dueDate: dueDateFromTerm(newDate, paymentTerm, dueDate) });
            }}
          />
        </Field>
        <Field label="Due Date" required>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => onChange({ dueDate: e.target.value, paymentTerm: "custom" })}
          />
        </Field>
      </div>

      <Field label="Payment Terms">
        <Select
          value={paymentTerm}
          onChange={(e) => {
            const term = e.target.value as PaymentTerm;
            onChange({ paymentTerm: term, dueDate: dueDateFromTerm(invoiceDate, term, dueDate) });
          }}
        >
          {PAYMENT_TERMS.map((t) => (
            <option key={t} value={t}>
              {PAYMENT_TERM_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Currency">
        <Select value={currency} onChange={(e) => onChange({ currency: e.target.value as CurrencyCode })}>
          {CURRENCY_LIST.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name} ({c.symbol})
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
