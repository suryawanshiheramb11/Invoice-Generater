// Core domain types for the invoice generator.
// All monetary values in this layer are decimal strings/numbers at the "display" precision
// for the given currency; actual safe arithmetic happens in src/lib/money.ts using integer minor units.

export type TemplateId = "classic" | "modern" | "minimal" | "business" | "gst";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "cancelled";

export type PaymentTerm =
  | "due_on_receipt"
  | "net_7"
  | "net_15"
  | "net_30"
  | "net_45"
  | "net_60"
  | "custom";

export type DiscountType = "percentage" | "fixed";

export type TaxMode = "simple" | "gst";

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD MMM YYYY";

export type LogoPosition = "left" | "center" | "right";

export type CurrencyCode =
  | "INR"
  | "USD"
  | "EUR"
  | "GBP"
  | "AED"
  | "CAD"
  | "AUD"
  | "SGD"
  | "JPY";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  /** Number of minor units (decimal places). JPY = 0, most others = 2. */
  decimals: number;
}

export interface Address {
  addressLine: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface BusinessInfo {
  name: string;
  logoUrl: string | null;
  address: Address;
  email: string;
  phone: string;
  website: string;
  taxNumber: string;
  registrationNumber: string;
}

export interface CustomerInfo {
  id: string | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: Address;
  taxId: string;
}

export interface ShippingInfo {
  sameAsBilling: boolean;
  address: Address;
}

export interface InvoiceItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  rate: number;
  taxRate: number; // percentage, used when taxMode === "simple"
  discountType: DiscountType;
  discountValue: number;
}

export interface GstConfig {
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  useIgst: boolean;
}

export interface PaymentInfo {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  swift: string;
  upiId: string;
  paymentLink: string;
  paypalEmail: string;
  otherInstructions: string;
  showQrCode: boolean;
}

export interface InvoiceCustomization {
  accentColor: string;
  fontFamily: string;
  logoPosition: LogoPosition;
  dateFormat: DateFormat;
  showPaymentInfo: boolean;
  showTaxColumn: boolean;
  showDiscountColumn: boolean;
}

export interface Invoice {
  id: string | null;
  userId: string | null;
  invoiceNumber: string;
  invoiceDate: string; // ISO date
  dueDate: string; // ISO date
  paymentTerm: PaymentTerm;
  currency: CurrencyCode;
  status: InvoiceStatus;
  template: TemplateId;

  business: BusinessInfo;
  customer: CustomerInfo;
  shipping: ShippingInfo;
  items: InvoiceItem[];

  taxMode: TaxMode;
  gst: GstConfig;

  discountType: DiscountType;
  discountValue: number;

  shippingCharge: number;
  otherCharges: number;

  notes: string;
  terms: string;
  paymentInstructions: string;
  paymentInfo: PaymentInfo;

  customization: InvoiceCustomization;

  createdAt: string | null;
  updatedAt: string | null;
}

export interface InvoiceTotals {
  subtotal: number;
  itemDiscountTotal: number;
  invoiceDiscount: number;
  taxableAmount: number;
  itemTaxTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  shipping: number;
  otherCharges: number;
  total: number;
}

export interface CustomerRecord {
  id: string;
  userId: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: Address;
  taxId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  businessName: string;
  logoUrl: string | null;
  address: Address;
  email: string;
  phone: string;
  website: string;
  taxNumber: string;
  registrationNumber: string;
  invoiceSequence: number;
  createdAt: string;
  updatedAt: string;
}
