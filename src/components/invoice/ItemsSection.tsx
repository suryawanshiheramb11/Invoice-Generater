"use client";

import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import type { CurrencyCode, InvoiceItem, TaxMode } from "@/types/invoice";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { createEmptyItem, duplicateItem, itemFinalAmount } from "@/lib/calculations";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

interface Props {
  items: InvoiceItem[];
  currency: CurrencyCode;
  taxMode: TaxMode;
  showTax: boolean;
  showDiscount: boolean;
  onChange: (items: InvoiceItem[]) => void;
}

export function ItemsSection({ items, currency, taxMode, showTax, showDiscount, onChange }: Props) {
  function updateItem(id: string, patch: Partial<InvoiceItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    if (items.length === 1) return;
    onChange(items.filter((it) => it.id !== id));
  }

  function duplicate(id: string) {
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return;
    const copy = [...items];
    copy.splice(idx + 1, 0, duplicateItem(items[idx]));
    onChange(copy);
  }

  function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((it) => it.id === id);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= items.length) return;
    const copy = [...items];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    onChange(copy);
  }

  const fieldLabel = "mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted";

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id} className="rounded-[18px] bg-[#F9FBF9] p-3.5 shadow-[0_2px_8px_rgba(20,60,45,0.04)]">
          <div className="space-y-1.5">
            <Input
              placeholder="Item name"
              value={item.name}
              onChange={(e) => updateItem(item.id, { name: e.target.value })}
              aria-label="Item name"
              className="bg-surface font-bold"
            />
            <Input
              placeholder="Description (optional)"
              value={item.description}
              onChange={(e) => updateItem(item.id, { description: e.target.value })}
              className="bg-surface"
              aria-label="Item description"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="w-20">
              <span className={fieldLabel}>Qty</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={item.quantity}
                onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                aria-label="Quantity"
                className="bg-surface px-2 text-center"
              />
            </div>
            <div className="min-w-[110px] flex-1">
              <span className={fieldLabel}>Rate</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={item.rate}
                onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) })}
                aria-label="Rate"
                className="bg-surface px-2.5"
              />
            </div>
            {showDiscount && (
              <div className="w-[132px]">
                <span className={fieldLabel}>Discount</span>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={item.discountValue}
                    onChange={(e) => updateItem(item.id, { discountValue: Number(e.target.value) })}
                    aria-label="Discount value"
                    className="min-w-0 flex-1 bg-surface px-2"
                  />
                  <select
                    value={item.discountType}
                    onChange={(e) => updateItem(item.id, { discountType: e.target.value as InvoiceItem["discountType"] })}
                    className="h-11 w-14 shrink-0 rounded-2xl border-[1.6px] border-border bg-surface px-1 text-xs font-bold"
                    aria-label="Discount type"
                  >
                    <option value="percentage">%</option>
                    <option value="fixed">Flat</option>
                  </select>
                </div>
              </div>
            )}
            {showTax && taxMode === "simple" && (
              <div className="w-20">
                <span className={fieldLabel}>Tax %</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={item.taxRate}
                  onChange={(e) => updateItem(item.id, { taxRate: Number(e.target.value) })}
                  aria-label="Tax rate"
                  className="bg-surface px-2"
                />
              </div>
            )}
            <div className="ml-auto shrink-0 text-right">
              <span className={cn(fieldLabel, "text-right")}>Amount</span>
              <span className="font-display text-base font-extrabold text-accent">
                {formatMoney(itemFinalAmount(item, currency, taxMode), currency)}
              </span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center gap-1 border-t border-border pt-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => move(item.id, -1)} disabled={idx === 0} aria-label="Move item up">
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => move(item.id, 1)}
              disabled={idx === items.length - 1}
              aria-label="Move item down"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => duplicate(item.id)}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(item.id)}
              disabled={items.length === 1}
              className="ml-auto text-danger hover:bg-danger-soft"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, createEmptyItem()])}
        className="w-full rounded-[18px] border-2 border-dashed border-accent-soft bg-[#F2F8F5] py-3.5 text-sm font-bold text-accent transition-colors hover:bg-accent-soft"
      >
        <Plus className="mr-1.5 inline h-3.5 w-3.5" /> Add another item
      </button>
    </div>
  );
}
