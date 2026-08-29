import type { Invoice } from "@/types/invoice";
import { createEmptyItem } from "@/lib/calculations";
import { dueDateFromTerm, todayIso } from "@/lib/dates";

export function emptyAddress() {
  return { addressLine: "", city: "", state: "", country: "", postalCode: "" };
}

export function createEmptyInvoice(invoiceNumber: string): Invoice {
  const invoiceDate = todayIso();
  return {
    id: null,
    userId: null,
    invoiceNumber,
    invoiceDate,
    dueDate: dueDateFromTerm(invoiceDate, "net_30"),
    paymentTerm: "net_30",
    currency: "INR",
    status: "draft",
    template: "modern",

    business: {
      name: "",
      logoUrl: null,
      address: emptyAddress(),
      email: "",
      phone: "",
      website: "",
      taxNumber: "",
      registrationNumber: "",
    },
    customer: {
      id: null,
      name: "",
      company: "",
      email: "",
      phone: "",
      address: emptyAddress(),
      taxId: "",
    },
    shipping: {
      sameAsBilling: true,
      address: emptyAddress(),
    },
    items: [createEmptyItem()],

    taxMode: "simple",
    gst: { cgstRate: 9, sgstRate: 9, igstRate: 18, useIgst: false },

    discountType: "percentage",
    discountValue: 0,

    shippingCharge: 0,
    otherCharges: 0,

    notes: "Thank you for your business!",
    terms: "Payment is due within 30 days of the invoice date.",
    paymentInstructions: "Please transfer payment to the bank account listed below.",
    paymentInfo: {
      bankName: "",
      accountHolder: "",
      accountNumber: "",
      ifsc: "",
      swift: "",
      upiId: "",
      paymentLink: "",
      paypalEmail: "",
      otherInstructions: "",
      showQrCode: true,
    },

    customization: {
      accentColor: "#4f46e5",
      fontFamily: "Inter",
      logoPosition: "left",
      dateFormat: "DD/MM/YYYY",
      showPaymentInfo: true,
      showTaxColumn: true,
      showDiscountColumn: true,
    },

    createdAt: null,
    updatedAt: null,
  };
}

export function createDemoInvoice(invoiceNumber: string): Invoice {
  const base = createEmptyInvoice(invoiceNumber);
  return {
    ...base,
    business: {
      name: "Acme Digital Solutions",
      logoUrl: null,
      address: {
        addressLine: "221B Baker Street, Suite 4",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        postalCode: "560001",
      },
      email: "hello@acmedigital.com",
      phone: "+91 98765 43210",
      website: "www.acmedigital.com",
      taxNumber: "29ABCDE1234F1Z5",
      registrationNumber: "U72900KA2019PTC123456",
    },
    customer: {
      id: null,
      name: "John Smith",
      company: "Smith & Co.",
      email: "john@smithco.com",
      phone: "+1 415 555 0132",
      address: {
        addressLine: "500 Market Street",
        city: "San Francisco",
        state: "CA",
        country: "United States",
        postalCode: "94105",
      },
      taxId: "",
    },
    items: [
      { ...createEmptyItem(), name: "Website Development", description: "Complete website development", quantity: 1, rate: 50000, taxRate: 18 },
      { ...createEmptyItem(), name: "UI/UX Design", description: "Design system and screens", quantity: 1, rate: 15000, taxRate: 18 },
      { ...createEmptyItem(), name: "Hosting (Annual)", description: "1 year managed hosting", quantity: 1, rate: 6000, taxRate: 18 },
    ],
    paymentInfo: {
      ...base.paymentInfo,
      bankName: "HDFC Bank",
      accountHolder: "Acme Digital Solutions",
      accountNumber: "50100123456789",
      ifsc: "HDFC0000123",
      swift: "HDFCINBB",
      upiId: "acmedigital@hdfcbank",
      paymentLink: "",
      paypalEmail: "",
      otherInstructions: "",
      showQrCode: true,
    },
  };
}
