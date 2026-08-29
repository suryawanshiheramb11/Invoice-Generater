import type { CurrencyCode, Invoice, InvoiceItem, InvoiceTotals } from "@/types/invoice";
import { multiplyMoney, percentOf, roundMoney, sumMoney } from "@/lib/money";

/** Gross amount for a line item before its own discount/tax: quantity x rate. */
export function itemGrossAmount(item: InvoiceItem, currency: CurrencyCode): number {
  return multiplyMoney(item.rate, item.quantity, currency);
}

/** Discount amount applied to a single line item. */
export function itemDiscountAmount(item: InvoiceItem, currency: CurrencyCode): number {
  const gross = itemGrossAmount(item, currency);
  if (item.discountType === "percentage") {
    return percentOf(gross, item.discountValue, currency);
  }
  return roundMoney(Math.min(item.discountValue, gross), currency);
}

/** Net amount for a line item after its discount, before tax. */
export function itemNetAmount(item: InvoiceItem, currency: CurrencyCode): number {
  return roundMoney(itemGrossAmount(item, currency) - itemDiscountAmount(item, currency), currency);
}

/** Tax amount for a single line item (only used in "simple" tax mode). */
export function itemTaxAmount(item: InvoiceItem, currency: CurrencyCode): number {
  return percentOf(itemNetAmount(item, currency), item.taxRate, currency);
}

/** Final display amount for a line item: net + tax (simple mode only; GST mode taxes the invoice total). */
export function itemFinalAmount(item: InvoiceItem, currency: CurrencyCode, taxMode: Invoice["taxMode"]): number {
  const net = itemNetAmount(item, currency);
  if (taxMode !== "simple") return net;
  return roundMoney(net + itemTaxAmount(item, currency), currency);
}

export function calculateInvoiceTotals(invoice: Invoice): InvoiceTotals {
  const { currency, items, taxMode, gst, discountType, discountValue, shippingCharge, otherCharges } = invoice;

  const subtotal = sumMoney(items.map((i) => itemGrossAmount(i, currency)), currency);
  const itemDiscountTotal = sumMoney(items.map((i) => itemDiscountAmount(i, currency)), currency);
  const netAfterItemDiscounts = roundMoney(subtotal - itemDiscountTotal, currency);

  const invoiceDiscount =
    discountType === "percentage"
      ? percentOf(netAfterItemDiscounts, discountValue, currency)
      : roundMoney(Math.min(discountValue, netAfterItemDiscounts), currency);

  const taxableAmount = roundMoney(netAfterItemDiscounts - invoiceDiscount, currency);

  let itemTaxTotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (taxMode === "simple") {
    // Each item's tax is computed on its own net amount, proportionally scaled down
    // by the invoice-level discount ratio so the invoice discount is reflected in tax.
    const ratio = netAfterItemDiscounts > 0 ? taxableAmount / netAfterItemDiscounts : 1;
    itemTaxTotal = sumMoney(
      items.map((i) => roundMoney(itemTaxAmount(i, currency) * ratio, currency)),
      currency
    );
  } else {
    if (gst.useIgst) {
      igst = percentOf(taxableAmount, gst.igstRate, currency);
    } else {
      cgst = percentOf(taxableAmount, gst.cgstRate, currency);
      sgst = percentOf(taxableAmount, gst.sgstRate, currency);
    }
  }

  const totalTax = roundMoney(itemTaxTotal + cgst + sgst + igst, currency);
  const shipping = roundMoney(shippingCharge || 0, currency);
  const other = roundMoney(otherCharges || 0, currency);

  const total = roundMoney(taxableAmount + totalTax + shipping + other, currency);

  return {
    subtotal,
    itemDiscountTotal,
    invoiceDiscount,
    taxableAmount,
    itemTaxTotal,
    cgst,
    sgst,
    igst,
    totalTax,
    shipping,
    otherCharges: other,
    total,
  };
}

export function generateItemId(): string {
  return `item_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createEmptyItem(): InvoiceItem {
  return {
    id: generateItemId(),
    name: "",
    description: "",
    quantity: 1,
    rate: 0,
    taxRate: 0,
    discountType: "percentage",
    discountValue: 0,
  };
}

export function duplicateItem(item: InvoiceItem): InvoiceItem {
  return { ...item, id: generateItemId() };
}
