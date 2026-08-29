"use client";

import { Field, Textarea } from "@/components/ui/Field";

interface Props {
  notes: string;
  terms: string;
  paymentInstructions: string;
  onChange: (patch: { notes?: string; terms?: string; paymentInstructions?: string }) => void;
}

export function NotesSection({ notes, terms, paymentInstructions, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Field label="Notes" hint="Shown to the customer, e.g. a thank-you message.">
        <Textarea value={notes} onChange={(e) => onChange({ notes: e.target.value })} rows={2} />
      </Field>
      <Field label="Terms & Conditions">
        <Textarea value={terms} onChange={(e) => onChange({ terms: e.target.value })} rows={2} />
      </Field>
      <Field label="Payment Instructions">
        <Textarea value={paymentInstructions} onChange={(e) => onChange({ paymentInstructions: e.target.value })} rows={2} />
      </Field>
    </div>
  );
}
