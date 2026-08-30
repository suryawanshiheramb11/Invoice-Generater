import type { CurrencyCode, Invoice } from "@/types/invoice";
import { calculateInvoiceTotals } from "@/lib/calculations";
import { formatMoney } from "@/lib/money";
import { displayStatus } from "@/lib/invoiceStatus";

interface CurrencyStats {
  currency: CurrencyCode;
  total: number;
  paid: number;
  outstanding: number;
  overdue: number;
}

export function StatsCards({ invoices }: { invoices: Invoice[] }) {
  const byCurrency = new Map<CurrencyCode, CurrencyStats>();

  for (const invoice of invoices) {
    if (invoice.status === "cancelled") continue;
    const total = calculateInvoiceTotals(invoice).total;
    const status = displayStatus(invoice);
    const entry = byCurrency.get(invoice.currency) ?? {
      currency: invoice.currency,
      total: 0,
      paid: 0,
      outstanding: 0,
      overdue: 0,
    };
    entry.total += total;
    if (status === "paid") entry.paid += total;
    else entry.outstanding += total;
    if (status === "overdue") entry.overdue += total;
    byCurrency.set(invoice.currency, entry);
  }

  const stats = Array.from(byCurrency.values());
  const activeCount = invoices.filter((i) => i.status !== "cancelled").length;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Total Invoices" value={String(activeCount)} />
      <HeroAmountCard label="Outstanding" stats={stats} field="outstanding" />
      <AmountCard label="Total Invoiced" stats={stats} field="total" />
      <AmountCard label="Paid" stats={stats} field="paid" tone="success" />
      <AmountCard label="Overdue" stats={stats} field="overdue" tone="danger" />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-surface p-5 shadow-[0_4px_14px_rgba(20,60,45,0.06)]">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-3 font-display text-2xl font-extrabold text-foreground">{value}</p>
    </div>
  );
}

function HeroAmountCard({
  label,
  stats,
  field,
}: {
  label: string;
  stats: CurrencyStats[];
  field: "total" | "paid" | "outstanding" | "overdue";
}) {
  const nonZero = stats.filter((s) => s[field] > 0);
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-accent p-5 shadow-[0_16px_34px_rgba(0,169,124,0.28)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-[130px] w-[130px] rounded-full bg-mint/40" />
      <p className="relative text-[11.5px] font-bold uppercase tracking-wide text-accent-soft">{label}</p>
      <div className="relative mt-3">
        {nonZero.length === 0 ? (
          <p className="font-display text-2xl font-extrabold text-white">—</p>
        ) : (
          nonZero.map((s) => (
            <p key={s.currency} className="font-display text-2xl font-extrabold tracking-tight text-white">
              {formatMoney(s[field], s.currency)}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function AmountCard({
  label,
  stats,
  field,
  tone,
}: {
  label: string;
  stats: CurrencyStats[];
  field: "total" | "paid" | "outstanding" | "overdue";
  tone?: "success" | "danger";
}) {
  const nonZero = stats.filter((s) => s[field] > 0);
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-[22px] bg-surface p-5 shadow-[0_4px_14px_rgba(20,60,45,0.06)]">
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted">{label}</p>
      {nonZero.length === 0 ? (
        <p className={"mt-3 font-display text-2xl font-extrabold " + "text-muted-soft"}>—</p>
      ) : (
        <div className="mt-3 space-y-0.5">
          {nonZero.map((s) => (
            <p key={s.currency} className={"font-display text-2xl font-extrabold " + toneClass}>
              {formatMoney(s[field], s.currency)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
