import { Document, Page, View, Text, Image as PdfImage, Link as PdfLink, StyleSheet, Font } from "@react-pdf/renderer";
import type { Invoice } from "@/types/invoice";
import { TEMPLATES } from "@/lib/templates";
import { calculateInvoiceTotals, itemFinalAmount } from "@/lib/calculations";
import { formatMoney } from "@/lib/money";
import { formatDate, PAYMENT_TERM_LABELS } from "@/lib/dates";

Font.registerHyphenationCallback((word) => [word]);

// Helvetica (react-pdf's built-in font) has no glyph for ₹ and other non-Latin-1 currency
// symbols, so it silently renders tofu/garbage. Noto Sans has broad Unicode coverage
// (₹, €, £, ¥, د.إ, etc.), is self-hosted, and works identically after deployment.
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: "/fonts/NotoSans-Variable.ttf", fontWeight: 400 },
    { src: "/fonts/NotoSans-Variable.ttf", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: "Noto Sans", color: "#1a1a1a" },
  accentBar: { height: 8, marginHorizontal: -40, marginTop: -40, marginBottom: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 48, height: 48, marginRight: 10, objectFit: "contain" },
  businessName: { fontSize: 13, fontWeight: 700, marginBottom: 3 },
  muted: { color: "#555555", fontSize: 8.5, lineHeight: 1.5 },
  invoiceTitle: { fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: "right" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", fontSize: 8.5, marginBottom: 1 },
  metaLabel: { color: "#666666", marginRight: 6 },
  metaValue: { fontWeight: 700 },
  section: { flexDirection: "row", justifyContent: "space-between", marginTop: 26 },
  sectionLabel: { fontSize: 8, fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 },
  table: { marginTop: 24 },
  tableHeader: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6 },
  tableHeaderText: { color: "#ffffff", fontSize: 8, fontWeight: 700 },
  tableRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5" },
  colItem: { flex: 4 },
  colSmall: { flex: 1, textAlign: "right" },
  colMed: { flex: 1.4, textAlign: "right" },
  totals: { marginTop: 14, alignSelf: "flex-end", width: 220 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  totalsLabel: { color: "#555555" },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, paddingTop: 6, marginTop: 4 },
  grandTotalLabel: { fontSize: 11, fontWeight: 700 },
  notesSection: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  notesBlock: { width: "48%" },
  paymentBlock: { marginTop: 24, borderWidth: 0.5, borderColor: "#e5e5e5", borderRadius: 4, padding: 12, flexDirection: "row", justifyContent: "space-between" },
  payBlock: { marginTop: 12, borderWidth: 0.5, borderRadius: 4, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  payButtonText: { fontSize: 10, fontWeight: 700, color: "#ffffff" },
  payHintText: { fontSize: 8, marginTop: 2 },
  footer: { position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "#aaaaaa" },
  qr: { width: 64, height: 64 },
  payQr: { width: 56, height: 56 },
});

function addr(a: { addressLine: string; city: string; state: string; country: string; postalCode: string }) {
  return [a.addressLine, [a.city, a.state, a.postalCode].filter(Boolean).join(", "), a.country].filter(Boolean);
}

export function InvoicePdfDocument({
  invoice,
  qrDataUrl,
  payUrl,
  payQrDataUrl,
}: {
  invoice: Invoice;
  qrDataUrl?: string | null;
  payUrl?: string | null;
  payQrDataUrl?: string | null;
}) {
  const style = TEMPLATES[invoice.template];
  const accent = invoice.customization.accentColor || style.defaultAccent;
  const totals = calculateInvoiceTotals(invoice);
  const fmt = (n: number) => formatMoney(n, invoice.currency);
  const fmtDate = (d: string) => formatDate(d, invoice.customization.dateFormat);
  const hasPayment =
    invoice.customization.showPaymentInfo &&
    Boolean(
      invoice.paymentInfo.bankName ||
        invoice.paymentInfo.accountNumber ||
        invoice.paymentInfo.upiId ||
        invoice.paymentInfo.paypalEmail ||
        invoice.paymentInfo.paymentLink
    );

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`}>
      <Page size="A4" style={styles.page} wrap>
        {style.showAccentBar && <View style={{ ...styles.accentBar, backgroundColor: accent }} />}

        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", flex: 1 }}>
            {invoice.business.logoUrl && <PdfImage src={invoice.business.logoUrl} style={styles.logo} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.businessName}>{invoice.business.name || "Your Business Name"}</Text>
              {addr(invoice.business.address).map((line) => (
                <Text key={line} style={styles.muted}>{line}</Text>
              ))}
              {invoice.business.email && <Text style={styles.muted}>{invoice.business.email}</Text>}
              {invoice.business.phone && <Text style={styles.muted}>{invoice.business.phone}</Text>}
              {invoice.business.taxNumber && <Text style={styles.muted}>Tax No: {invoice.business.taxNumber}</Text>}
            </View>
          </View>
          <View>
            <Text style={{ ...styles.invoiceTitle, color: accent }}>INVOICE</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice #:</Text>
              <Text style={styles.metaValue}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date:</Text>
              <Text style={styles.metaValue}>{fmtDate(invoice.invoiceDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due:</Text>
              <Text style={styles.metaValue}>{fmtDate(invoice.dueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Terms:</Text>
              <Text style={styles.metaValue}>{PAYMENT_TERM_LABELS[invoice.paymentTerm]}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={{ width: "60%" }}>
            <Text style={{ ...styles.sectionLabel, color: accent }}>BILL TO</Text>
            <Text style={{ fontWeight: 700, marginBottom: 2 }}>{invoice.customer.name || "Customer Name"}</Text>
            {invoice.customer.company && <Text style={styles.muted}>{invoice.customer.company}</Text>}
            {addr(invoice.customer.address).map((line) => (
              <Text key={line} style={styles.muted}>{line}</Text>
            ))}
            {invoice.customer.email && <Text style={styles.muted}>{invoice.customer.email}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={{ ...styles.tableHeader, backgroundColor: accent }}>
            <Text style={{ ...styles.tableHeaderText, ...styles.colItem }}>Item</Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colSmall }}>Qty</Text>
            <Text style={{ ...styles.tableHeaderText, ...styles.colMed }}>Rate</Text>
            {invoice.taxMode === "simple" && <Text style={{ ...styles.tableHeaderText, ...styles.colSmall }}>Tax</Text>}
            <Text style={{ ...styles.tableHeaderText, ...styles.colMed }}>Amount</Text>
          </View>
          {invoice.items.map((item) => (
            <View key={item.id} style={styles.tableRow} wrap={false}>
              <View style={styles.colItem}>
                <Text style={{ fontWeight: 700 }}>{item.name || "Item"}</Text>
                {item.description && <Text style={{ ...styles.muted, fontSize: 8 }}>{item.description}</Text>}
              </View>
              <Text style={styles.colSmall}>{item.quantity}</Text>
              <Text style={styles.colMed}>{fmt(item.rate)}</Text>
              {invoice.taxMode === "simple" && <Text style={styles.colSmall}>{item.taxRate ? `${item.taxRate}%` : "—"}</Text>}
              <Text style={{ ...styles.colMed, fontWeight: 700 }}>{fmt(itemFinalAmount(item, invoice.currency, invoice.taxMode))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text>{fmt(totals.subtotal)}</Text>
          </View>
          {totals.itemDiscountTotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Item Discounts</Text>
              <Text>-{fmt(totals.itemDiscountTotal)}</Text>
            </View>
          )}
          {totals.invoiceDiscount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text>-{fmt(totals.invoiceDiscount)}</Text>
            </View>
          )}
          {invoice.taxMode === "gst" ? (
            invoice.gst.useIgst ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>IGST ({invoice.gst.igstRate}%)</Text>
                <Text>{fmt(totals.igst)}</Text>
              </View>
            ) : (
              <>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>CGST ({invoice.gst.cgstRate}%)</Text>
                  <Text>{fmt(totals.cgst)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>SGST ({invoice.gst.sgstRate}%)</Text>
                  <Text>{fmt(totals.sgst)}</Text>
                </View>
              </>
            )
          ) : (
            totals.totalTax > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax</Text>
                <Text>{fmt(totals.totalTax)}</Text>
              </View>
            )
          )}
          {totals.shipping > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Shipping</Text>
              <Text>{fmt(totals.shipping)}</Text>
            </View>
          )}
          {totals.otherCharges > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Other Charges</Text>
              <Text>{fmt(totals.otherCharges)}</Text>
            </View>
          )}
          <View style={{ ...styles.grandTotalRow, borderTopColor: accent }}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={{ ...styles.grandTotalLabel, color: accent }}>{fmt(totals.total)}</Text>
          </View>
        </View>

        {(invoice.notes || invoice.terms) && (
          <View style={styles.notesSection}>
            {invoice.notes && (
              <View style={styles.notesBlock}>
                <Text style={{ ...styles.sectionLabel, color: accent }}>NOTES</Text>
                <Text style={styles.muted}>{invoice.notes}</Text>
              </View>
            )}
            {invoice.terms && (
              <View style={styles.notesBlock}>
                <Text style={{ ...styles.sectionLabel, color: accent }}>TERMS & CONDITIONS</Text>
                <Text style={styles.muted}>{invoice.terms}</Text>
              </View>
            )}
          </View>
        )}

        {hasPayment && (
          <View style={styles.paymentBlock} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...styles.sectionLabel, color: accent }}>PAYMENT INFORMATION</Text>
              {invoice.paymentInstructions && <Text style={styles.muted}>{invoice.paymentInstructions}</Text>}
              {invoice.paymentInfo.bankName && <Text style={styles.muted}>Bank: {invoice.paymentInfo.bankName}</Text>}
              {invoice.paymentInfo.accountHolder && <Text style={styles.muted}>Account Holder: {invoice.paymentInfo.accountHolder}</Text>}
              {invoice.paymentInfo.accountNumber && <Text style={styles.muted}>Account No: {invoice.paymentInfo.accountNumber}</Text>}
              {invoice.paymentInfo.ifsc && <Text style={styles.muted}>IFSC: {invoice.paymentInfo.ifsc}</Text>}
              {invoice.paymentInfo.swift && <Text style={styles.muted}>SWIFT: {invoice.paymentInfo.swift}</Text>}
              {invoice.paymentInfo.upiId && <Text style={styles.muted}>UPI ID: {invoice.paymentInfo.upiId}</Text>}
              {invoice.paymentInfo.paypalEmail && <Text style={styles.muted}>PayPal: {invoice.paymentInfo.paypalEmail}</Text>}
            </View>
            {qrDataUrl && <PdfImage src={qrDataUrl} style={styles.qr} />}
          </View>
        )}

        {payUrl && (
          <PdfLink src={payUrl} style={{ ...styles.payBlock, borderColor: accent, backgroundColor: accent }} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payButtonText}>Pay this invoice online / Submit payment proof</Text>
              <Text style={{ ...styles.payHintText, color: "#ffffff" }}>{payUrl}</Text>
            </View>
            {payQrDataUrl && <PdfImage src={payQrDataUrl} style={styles.payQr} />}
          </PdfLink>
        )}

        <Text style={styles.footer} fixed>
          Generated with Invoice Generator
        </Text>
      </Page>
    </Document>
  );
}
