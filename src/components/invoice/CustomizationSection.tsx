"use client";

import type { DateFormat, InvoiceCustomization, LogoPosition, TemplateId } from "@/types/invoice";
import { Field, Select, Checkbox } from "@/components/ui/Field";
import { TEMPLATE_LIST } from "@/lib/templates";
import { cn } from "@/lib/cn";

interface Props {
  template: TemplateId;
  customization: InvoiceCustomization;
  onTemplateChange: (template: TemplateId) => void;
  onChange: (patch: Partial<InvoiceCustomization>) => void;
}

const ACCENT_PRESETS = ["#00A97C", "#0f766e", "#b45309", "#1f2937", "#dc2626", "#2563eb", "#7c3aed", "#111111"];
const FONTS = ["Inter", "Georgia", "Arial", "Helvetica"];
const DATE_FORMATS: DateFormat[] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"];

export function CustomizationSection({ template, customization, onTemplateChange, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Template</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEMPLATE_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTemplateChange(t.id)}
              className={cn(
                "rounded-2xl border-[1.6px] px-3.5 py-2.5 text-left text-xs transition-colors",
                template === t.id ? "border-accent bg-accent-soft text-accent" : "border-border bg-[#F2F8F5] hover:bg-accent-soft/40"
              )}
            >
              <span className="block font-bold">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Accent Color</p>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use accent color ${color}`}
              onClick={() => onChange({ accentColor: color })}
              className={cn(
                "h-7 w-7 rounded-full border-2",
                customization.accentColor === color ? "border-foreground" : "border-transparent"
              )}
              style={{ background: color }}
            />
          ))}
          <input
            type="color"
            aria-label="Custom accent color"
            value={customization.accentColor}
            onChange={(e) => onChange({ accentColor: e.target.value })}
            className="h-7 w-7 cursor-pointer rounded-full border border-border-strong bg-transparent p-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Font">
          <Select value={customization.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Logo Position">
          <Select value={customization.logoPosition} onChange={(e) => onChange({ logoPosition: e.target.value as LogoPosition })}>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </Select>
        </Field>
      </div>

      <Field label="Date Format">
        <Select value={customization.dateFormat} onChange={(e) => onChange({ dateFormat: e.target.value as DateFormat })}>
          {DATE_FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={customization.showTaxColumn} onChange={(e) => onChange({ showTaxColumn: e.target.checked })} />
          Show tax column on items table
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={customization.showDiscountColumn} onChange={(e) => onChange({ showDiscountColumn: e.target.checked })} />
          Show discount column on items table
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={customization.showPaymentInfo} onChange={(e) => onChange({ showPaymentInfo: e.target.checked })} />
          Show payment information on invoice
        </label>
      </div>
    </div>
  );
}
