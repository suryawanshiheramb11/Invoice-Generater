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
      accentColor: "#00A97C",
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

