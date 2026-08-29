import type { CurrencyCode, Invoice } from "@/types/invoice";
import { calculateInvoiceTotals } from "@/lib/calculations";
import { formatMoney } from "@/lib/money";
import { displayStatus } from "@/lib/invoiceStatus";
import { Card } from "@/components/ui/Card";

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
      <AmountCard label="Total Invoiced" stats={stats} field="total" />
      <AmountCard label="Paid" stats={stats} field="paid" tone="success" />
      <AmountCard label="Outstanding" stats={stats} field="outstanding" tone="warning" />
      <AmountCard label="Overdue" stats={stats} field="overdue" tone="warning" />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold">{value}</p>
    </Card>
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
  tone?: "success" | "warning";
}) {
  const nonZero = stats.filter((s) => s[field] > 0);
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      {nonZero.length === 0 ? (
        <p className="mt-1.5 text-2xl font-semibold text-muted">—</p>
      ) : (
        <div className="mt-1.5 space-y-0.5">
          {nonZero.map((s) => (
            <p
              key={s.currency}
              className={
                "text-xl font-semibold " + (tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "")
              }
            >
              {formatMoney(s[field], s.currency)}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
