"use client";

import type { DiscountType, GstConfig, Invoice, TaxMode } from "@/types/invoice";
import { Field, Input, Select } from "@/components/ui/Field";
import { calculateInvoiceTotals } from "@/lib/calculations";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

interface Props {
  invoice: Invoice;
  onChange: (patch: Partial<Invoice>) => void;
}

export function TotalsSection({ invoice, onChange }: Props) {
  const totals = calculateInvoiceTotals(invoice);
  const fmt = (n: number) => formatMoney(n, invoice.currency);

  function updateGst(patch: Partial<GstConfig>) {
    onChange({ gst: { ...invoice.gst, ...patch } });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Invoice Discount</p>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step="any"
            value={invoice.discountValue}
            onChange={(e) => onChange({ discountValue: Number(e.target.value) })}
          />
          <Select
            value={invoice.discountType}
            onChange={(e) => onChange({ discountType: e.target.value as DiscountType })}
            className="w-28"
          >
            <option value="percentage">%</option>
            <option value="fixed">Flat</option>
          </Select>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">Tax Mode</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ taxMode: "simple" as TaxMode })}
            className={cn(
              "rounded-2xl border-[1.6px] px-3.5 py-2.5 text-left text-xs transition-colors",
              invoice.taxMode === "simple" ? "border-accent bg-accent-soft" : "border-border bg-[#F2F8F5]"
            )}
          >
            <span className="block font-bold text-foreground">Simple Tax</span>
            <span className="block text-[11px] text-muted">Single % per item</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ taxMode: "gst" as TaxMode })}
            className={cn(
              "rounded-2xl border-[1.6px] px-3.5 py-2.5 text-left text-xs transition-colors",
              invoice.taxMode === "gst" ? "border-accent bg-accent-soft" : "border-border bg-[#F2F8F5]"
            )}
          >
            <span className="block font-bold text-foreground">GST (India)</span>
            <span className="block text-[11px] text-muted">CGST / SGST / IGST</span>
          </button>
        </div>
      </div>

      {invoice.taxMode === "gst" && (
        <div className="rounded-2xl bg-[#F2F8F5] p-3.5">
          <label className="flex items-center gap-2 text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={invoice.gst.useIgst}
              onChange={(e) => updateGst({ useIgst: e.target.checked })}
              className="h-3.5 w-3.5 accent-[color:var(--accent)]"
            />
            Inter-state supply (use IGST instead of CGST + SGST)
          </label>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {invoice.gst.useIgst ? (
              <Field label="IGST %">
                <Input type="number" min={0} step="any" value={invoice.gst.igstRate} onChange={(e) => updateGst({ igstRate: Number(e.target.value) })} className="bg-surface" />
              </Field>
            ) : (
              <>
                <Field label="CGST %">
                  <Input type="number" min={0} step="any" value={invoice.gst.cgstRate} onChange={(e) => updateGst({ cgstRate: Number(e.target.value) })} className="bg-surface" />
                </Field>
                <Field label="SGST %">
                  <Input type="number" min={0} step="any" value={invoice.gst.sgstRate} onChange={(e) => updateGst({ sgstRate: Number(e.target.value) })} className="bg-surface" />
                </Field>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Shipping Charge">
          <Input type="number" min={0} step="any" value={invoice.shippingCharge} onChange={(e) => onChange({ shippingCharge: Number(e.target.value) })} />
        </Field>
        <Field label="Other Charges">
          <Input type="number" min={0} step="any" value={invoice.otherCharges} onChange={(e) => onChange({ otherCharges: Number(e.target.value) })} />
        </Field>
      </div>

      <div className="space-y-2 rounded-2xl bg-ink p-4 text-sm">
        <SummaryRow label="Subtotal" value={fmt(totals.subtotal)} />
        {totals.itemDiscountTotal > 0 && <SummaryRow label="Item discounts" value={`-${fmt(totals.itemDiscountTotal)}`} />}
        {totals.invoiceDiscount > 0 && <SummaryRow label="Invoice discount" value={`-${fmt(totals.invoiceDiscount)}`} />}
        {invoice.taxMode === "gst" ? (
          invoice.gst.useIgst ? (
            <SummaryRow label={`IGST (${invoice.gst.igstRate}%)`} value={fmt(totals.igst)} />
          ) : (
            <>
              <SummaryRow label={`CGST (${invoice.gst.cgstRate}%)`} value={fmt(totals.cgst)} />
              <SummaryRow label={`SGST (${invoice.gst.sgstRate}%)`} value={fmt(totals.sgst)} />
            </>
          )
        ) : (
          totals.itemTaxTotal > 0 && <SummaryRow label="Tax" value={fmt(totals.itemTaxTotal)} />
        )}
        {totals.shipping > 0 && <SummaryRow label="Shipping" value={fmt(totals.shipping)} />}
        {totals.otherCharges > 0 && <SummaryRow label="Other charges" value={fmt(totals.otherCharges)} />}
        <div className="flex items-baseline justify-between border-t border-ink-line pt-3 text-sm">
          <span className="font-bold text-white">Total</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-mint">{fmt(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between font-medium text-muted-on-ink">
      <span>{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
