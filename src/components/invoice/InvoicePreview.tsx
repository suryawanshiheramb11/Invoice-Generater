"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { Invoice } from "@/types/invoice";
import { TEMPLATES } from "@/lib/templates";
import { calculateInvoiceTotals, itemFinalAmount } from "@/lib/calculations";
import { formatMoney } from "@/lib/money";
import { formatDate, PAYMENT_TERM_LABELS } from "@/lib/dates";
import { buildUpiUri } from "@/lib/upi";
import { useQrDataUrl } from "@/hooks/useQrDataUrl";
import { cn } from "@/lib/cn";

export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const style = TEMPLATES[invoice.template];
  const accent = invoice.customization.accentColor || style.defaultAccent;
  const totals = calculateInvoiceTotals(invoice);
  const shipTo = invoice.shipping.sameAsBilling ? invoice.customer.address : invoice.shipping.address;

  const upiUri = invoice.paymentInfo.showQrCode
    ? buildUpiUri(invoice.paymentInfo, invoice.business.name, totals.total, invoice.currency, invoice.invoiceNumber)
    : null;
  const qrDataUrl = useQrDataUrl(upiUri);

  const fmt = (n: number) => formatMoney(n, invoice.currency);
  const fmtDate = (d: string) => formatDate(d, invoice.customization.dateFormat);
  const heading = (text: string) => (style.uppercaseHeadings ? text.toUpperCase() : text);

  return (
    <div
      id="invoice-print-area"
      className="invoice-page mx-auto flex flex-col p-10 text-[13px] leading-relaxed"
      style={{ fontFamily: style.fontFamily }}
    >
      {style.showAccentBar && <div className="-mx-10 -mt-10 mb-8 h-2.5" style={{ background: accent }} />}

      {/* Header */}
      <div
        className={cn(
          "flex gap-6",
          style.headerLayout === "stacked" ? "flex-col" : "flex-row items-start justify-between",
          style.headerLayout === "banner" && "rounded-lg p-5"
        )}
        style={style.headerLayout === "banner" ? { background: hexToSoft(accent) } : undefined}
      >
        <div className={cn("flex items-start gap-4", invoice.customization.logoPosition === "right" && "order-2")}>
          {invoice.business.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={invoice.business.logoUrl}
              alt={`${invoice.business.name} logo`}
              className="h-14 w-14 shrink-0 rounded-md object-contain"
            />
          )}
          <div>
            <p className="text-lg font-bold" style={{ color: style.headerLayout === "banner" ? accent : undefined }}>
              {invoice.business.name || "Your Business Name"}
            </p>
            <div className="mt-1 text-xs text-gray-600">
              {invoice.business.address.addressLine && <p>{invoice.business.address.addressLine}</p>}
              <p>
                {[invoice.business.address.city, invoice.business.address.state, invoice.business.address.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {invoice.business.address.country && <p>{invoice.business.address.country}</p>}
              {invoice.business.email && <p>{invoice.business.email}</p>}
              {invoice.business.phone && <p>{invoice.business.phone}</p>}
              {invoice.business.website && <p>{invoice.business.website}</p>}
              {invoice.business.taxNumber && <p>Tax No: {invoice.business.taxNumber}</p>}
            </div>
          </div>
        </div>

        <div className={cn("text-right", style.headerLayout === "stacked" && "text-left")}>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: accent }}>
            {heading("Invoice")}
          </h1>
          <dl className="mt-2 space-y-0.5 text-xs">
            <Row label="Invoice #" value={invoice.invoiceNumber} />
            <Row label="Invoice Date" value={fmtDate(invoice.invoiceDate)} />
            <Row label="Due Date" value={fmtDate(invoice.dueDate)} />
            <Row label="Payment Terms" value={PAYMENT_TERM_LABELS[invoice.paymentTerm]} />
          </dl>
        </div>
      </div>

      {/* Bill To / Ship To */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
            Bill To
          </p>
          <p className="mt-1.5 font-medium">{invoice.customer.name || "Customer Name"}</p>
          {invoice.customer.company && <p className="text-gray-600">{invoice.customer.company}</p>}
          <div className="mt-0.5 text-xs text-gray-600">
            {invoice.customer.address.addressLine && <p>{invoice.customer.address.addressLine}</p>}
            <p>
              {[invoice.customer.address.city, invoice.customer.address.state, invoice.customer.address.postalCode]
                .filter(Boolean)
                .join(", ")}
            </p>
            {invoice.customer.address.country && <p>{invoice.customer.address.country}</p>}
            {invoice.customer.email && <p>{invoice.customer.email}</p>}
            {invoice.customer.phone && <p>{invoice.customer.phone}</p>}
            {invoice.customer.taxId && <p>Tax ID: {invoice.customer.taxId}</p>}
          </div>
        </div>

        {!invoice.shipping.sameAsBilling && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
              Ship To
            </p>
            <div className="mt-1.5 text-xs text-gray-600">
              {shipTo.addressLine && <p>{shipTo.addressLine}</p>}
              <p>{[shipTo.city, shipTo.state, shipTo.postalCode].filter(Boolean).join(", ")}</p>
              {shipTo.country && <p>{shipTo.country}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Items table */}
      <table className="mt-8 w-full border-collapse text-xs">
        <thead>
          <tr
            className={cn(
              style.tableStyle === "boxed" && "border border-gray-300",
              style.tableStyle !== "minimal" && "text-white"
            )}
            style={{ background: style.tableStyle === "minimal" ? undefined : accent }}
          >
            <Th className={style.tableStyle === "minimal" ? "border-b-2 border-black text-black" : ""}>Item</Th>
            <Th className={style.tableStyle === "minimal" ? "border-b-2 border-black text-black" : ""}>Qty</Th>
            <Th className={style.tableStyle === "minimal" ? "border-b-2 border-black text-black" : ""} align="right">
              Rate
            </Th>
            {invoice.customization.showDiscountColumn && (
              <Th className={style.tableStyle === "minimal" ? "border-b-2 border-black text-black" : ""} align="right">
                Discount
              </Th>
            )}
            {invoice.customization.showTaxColumn && invoice.taxMode === "simple" && (
              <Th className={style.tableStyle === "minimal" ? "border-b-2 border-black text-black" : ""} align="right">
                Tax
              </Th>
            )}
            <Th className={style.tableStyle === "minimal" ? "border-b-2 border-black text-black" : ""} align="right">
              Amount
            </Th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => (
            <tr
              key={item.id}
              className={cn(
                style.tableStyle === "boxed" && "border-x border-b border-gray-300",
                style.tableStyle === "zebra" && idx % 2 === 1 && "bg-gray-50",
                style.tableStyle === "lined" && "border-b border-gray-200",
                style.tableStyle === "minimal" && "border-b border-gray-100"
              )}
            >
              <Td>
                <p className="font-medium">{item.name || "Item name"}</p>
                {item.description && <p className="text-[11px] text-gray-500">{item.description}</p>}
              </Td>
              <Td>{item.quantity}</Td>
              <Td align="right">{fmt(item.rate)}</Td>
              {invoice.customization.showDiscountColumn && (
                <Td align="right">
                  {item.discountValue > 0
                    ? item.discountType === "percentage"
                      ? `${item.discountValue}%`
                      : fmt(item.discountValue)
                    : "—"}
                </Td>
              )}
              {invoice.customization.showTaxColumn && invoice.taxMode === "simple" && (
                <Td align="right">{item.taxRate > 0 ? `${item.taxRate}%` : "—"}</Td>
              )}
              <Td align="right" className="font-medium">
                {fmt(itemFinalAmount(item, invoice.currency, invoice.taxMode))}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-[280px] space-y-1.5 text-xs">
          <TotalRow label="Subtotal" value={fmt(totals.subtotal)} />
          {totals.itemDiscountTotal > 0 && <TotalRow label="Item Discounts" value={`-${fmt(totals.itemDiscountTotal)}`} />}
          {totals.invoiceDiscount > 0 && (
            <TotalRow
              label={`Discount${invoice.discountType === "percentage" ? ` (${invoice.discountValue}%)` : ""}`}
              value={`-${fmt(totals.invoiceDiscount)}`}
            />
          )}
          {invoice.taxMode === "gst" ? (
            <>
              {invoice.gst.useIgst ? (
                <TotalRow label={`IGST (${invoice.gst.igstRate}%)`} value={fmt(totals.igst)} />
              ) : (
                <>
                  <TotalRow label={`CGST (${invoice.gst.cgstRate}%)`} value={fmt(totals.cgst)} />
                  <TotalRow label={`SGST (${invoice.gst.sgstRate}%)`} value={fmt(totals.sgst)} />
                </>
              )}
            </>
          ) : (
            totals.totalTax > 0 && <TotalRow label="Tax" value={fmt(totals.totalTax)} />
          )}
          {totals.shipping > 0 && <TotalRow label="Shipping" value={fmt(totals.shipping)} />}
          {totals.otherCharges > 0 && <TotalRow label="Other Charges" value={fmt(totals.otherCharges)} />}
          <div className="mt-2 flex items-center justify-between border-t-2 pt-2 text-sm font-bold" style={{ borderColor: accent }}>
            <span>Total</span>
            <span style={{ color: accent }}>{fmt(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes / Terms */}
      <div className="mt-8 grid grid-cols-2 gap-6 text-xs">
        {invoice.notes && (
          <div>
            <p className="font-semibold" style={{ color: accent }}>
              Notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-gray-600">{invoice.notes}</p>
          </div>
        )}
        {invoice.terms && (
          <div>
            <p className="font-semibold" style={{ color: accent }}>
              Terms &amp; Conditions
            </p>
            <p className="mt-1 whitespace-pre-wrap text-gray-600">{invoice.terms}</p>
          </div>
        )}
      </div>

      {/* Payment info */}
      {invoice.customization.showPaymentInfo && hasPaymentInfo(invoice) && (
        <div className="mt-8 flex items-start justify-between gap-6 rounded-lg border border-gray-200 p-4 text-xs">
          <div className="space-y-0.5">
            <p className="font-semibold" style={{ color: accent }}>
              Payment Information
            </p>
            {invoice.paymentInstructions && <p className="mb-1 text-gray-600">{invoice.paymentInstructions}</p>}
            {invoice.paymentInfo.bankName && <p>Bank: {invoice.paymentInfo.bankName}</p>}
            {invoice.paymentInfo.accountHolder && <p>Account Holder: {invoice.paymentInfo.accountHolder}</p>}
            {invoice.paymentInfo.accountNumber && <p>Account No: {invoice.paymentInfo.accountNumber}</p>}
            {invoice.paymentInfo.ifsc && <p>IFSC: {invoice.paymentInfo.ifsc}</p>}
            {invoice.paymentInfo.swift && <p>SWIFT: {invoice.paymentInfo.swift}</p>}
            {invoice.paymentInfo.upiId && <p>UPI ID: {invoice.paymentInfo.upiId}</p>}
            {invoice.paymentInfo.paypalEmail && <p>PayPal: {invoice.paymentInfo.paypalEmail}</p>}
            {invoice.paymentInfo.paymentLink && <p>Pay online: {invoice.paymentInfo.paymentLink}</p>}
            {invoice.paymentInfo.otherInstructions && <p className="mt-1 text-gray-600">{invoice.paymentInfo.otherInstructions}</p>}
          </div>
          {qrDataUrl && (
            <div className="shrink-0 text-center">
              <Image src={qrDataUrl} alt="UPI payment QR code" width={90} height={90} unoptimized />
              <p className="mt-1 text-[10px] text-gray-500">Scan to pay via UPI</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto pt-8 text-center text-[11px] text-gray-400">
        Generated with Invoice Generator
      </div>
    </div>
  );
}

function hasPaymentInfo(invoice: Invoice) {
  const p = invoice.paymentInfo;
  return Boolean(
    p.bankName || p.accountHolder || p.accountNumber || p.ifsc || p.swift || p.upiId || p.paypalEmail || p.paymentLink || p.otherInstructions
  );
}

function hexToSoft(hex: string) {
  return `${hex}14`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-end gap-3">
      <dt className="text-gray-500">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Th({ children, align = "left", className }: { children: ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <th className={cn("px-3 py-2 font-semibold", align === "right" ? "text-right" : "text-left", className)}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", className }: { children: ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={cn("px-3 py-2", align === "right" ? "text-right" : "text-left", className)}>{children}</td>;
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
