import type { DateFormat, PaymentTerm } from "@/types/invoice";

export const PAYMENT_TERM_LABELS: Record<PaymentTerm, string> = {
  due_on_receipt: "Due on receipt",
  net_7: "Net 7",
  net_15: "Net 15",
  net_30: "Net 30",
  net_45: "Net 45",
  net_60: "Net 60",
  custom: "Custom",
};

const PAYMENT_TERM_DAYS: Record<Exclude<PaymentTerm, "custom">, number> = {
  due_on_receipt: 0,
  net_7: 7,
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dueDateFromTerm(invoiceDateIso: string, term: PaymentTerm, currentDueDate?: string): string {
  if (term === "custom") return currentDueDate ?? invoiceDateIso;
  return addDaysIso(invoiceDateIso, PAYMENT_TERM_DAYS[term]);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(dateIso: string, format: DateFormat): string {
  if (!dateIso) return "";
  const [y, m, d] = dateIso.split("-");
  if (!y || !m || !d) return dateIso;
  switch (format) {
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "MM/DD/YYYY":
      return `${m}/${d}/${y}`;
    case "YYYY-MM-DD":
      return `${y}-${m}-${d}`;
    case "DD MMM YYYY":
      return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
    default:
      return `${d}/${m}/${y}`;
  }
}

export function isOverdue(dueDateIso: string, status: string): boolean {
  if (status === "paid" || status === "cancelled") return false;
  const today = todayIso();
  return dueDateIso < today;
}
