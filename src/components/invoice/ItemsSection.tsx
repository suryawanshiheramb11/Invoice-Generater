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

  return (
    <div className="space-y-3">
      <div className="hidden gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted sm:grid sm:grid-cols-12">
        <div className="col-span-4">Item</div>
        <div className="col-span-1">Qty</div>
        <div className="col-span-2">Rate</div>
        {showDiscount && <div className="col-span-2">Discount</div>}
        {showTax && taxMode === "simple" && <div className="col-span-1">Tax %</div>}
        <div className={cn("text-right", showDiscount && showTax ? "col-span-2" : "col-span-3")}>Amount</div>
      </div>

      {items.map((item, idx) => (
        <div key={item.id} className="rounded-lg border border-border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-start">
            <div className="sm:col-span-4">
              <Input
                placeholder="Item name"
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                aria-label="Item name"
              />
              <Input
                placeholder="Description (optional)"
                value={item.description}
                onChange={(e) => updateItem(item.id, { description: e.target.value })}
                className="mt-1.5"
                aria-label="Item description"
              />
            </div>
            <div className="sm:col-span-1">
              <Input
                type="number"
                min={0}
                step="any"
                value={item.quantity}
                onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                aria-label="Quantity"
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                type="number"
                min={0}
                step="any"
                value={item.rate}
                onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) })}
                aria-label="Rate"
              />
            </div>
            {showDiscount && (
              <div className="flex gap-1 sm:col-span-2">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={item.discountValue}
                  onChange={(e) => updateItem(item.id, { discountValue: Number(e.target.value) })}
                  aria-label="Discount value"
                />
                <select
                  value={item.discountType}
                  onChange={(e) => updateItem(item.id, { discountType: e.target.value as InvoiceItem["discountType"] })}
                  className="h-9 rounded-md border border-border-strong bg-surface px-1 text-xs"
                  aria-label="Discount type"
                >
                  <option value="percentage">%</option>
                  <option value="fixed">Flat</option>
                </select>
              </div>
            )}
            {showTax && taxMode === "simple" && (
              <div className="sm:col-span-1">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={item.taxRate}
                  onChange={(e) => updateItem(item.id, { taxRate: Number(e.target.value) })}
                  aria-label="Tax rate"
                />
              </div>
            )}
            <div
              className={cn(
                "flex items-center justify-between gap-1 sm:justify-end",
                showDiscount && showTax ? "sm:col-span-2" : "sm:col-span-3"
              )}
            >
              <span className="text-sm font-medium sm:hidden">Amount:</span>
              <span className="text-sm font-semibold">{formatMoney(itemFinalAmount(item, currency, taxMode), currency)}</span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
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

      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, createEmptyItem()])}>
        <Plus className="h-3.5 w-3.5" /> Add item
      </Button>
    </div>
  );
}
