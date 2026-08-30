"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, Pencil, Printer, Search, Trash2 } from "lucide-react";
import type { CurrencyCode, Invoice, InvoiceStatus } from "@/types/invoice";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { calculateInvoiceTotals } from "@/lib/calculations";
import { displayStatus, STATUS_LABELS, STATUS_TONE } from "@/lib/invoiceStatus";
import { deleteInvoice, prepareDuplicateInvoice, saveInvoice } from "@/services/invoices";
import { buildUpiUri } from "@/lib/upi";
import { cn } from "@/lib/cn";
import { avatarColor, initialsOf } from "@/lib/avatar";

type SortKey = "newest" | "oldest" | "highest" | "lowest";

export function InvoicesTable({ invoices, onChange }: { invoices: Invoice[]; onChange: () => void }) {
  const router = useRouter();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [currency, setCurrency] = useState<CurrencyCode | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = invoices.filter((inv) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customer.name.toLowerCase().includes(q) ||
        inv.customer.email.toLowerCase().includes(q);
      const matchesStatus = status === "all" || displayStatus(inv) === status;
      const matchesCurrency = currency === "all" || inv.currency === currency;
      return matchesQuery && matchesStatus && matchesCurrency;
    });

    list = [...list].sort((a, b) => {
      if (sort === "newest") return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      if (sort === "oldest") return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
      const totalA = calculateInvoiceTotals(a).total;
      const totalB = calculateInvoiceTotals(b).total;
      return sort === "highest" ? totalB - totalA : totalA - totalB;
    });

    return list;
  }, [invoices, query, status, currency, sort]);

  async function handleDuplicate(invoice: Invoice) {
    setBusyId(invoice.id);
    try {
      const copy = await prepareDuplicateInvoice(invoice);
      await saveInvoice(copy);
      show("Invoice duplicated.", "success");
      onChange();
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete?.id) return;
    setBusyId(confirmDelete.id);
    try {
      await deleteInvoice(confirmDelete.id);
      show("Invoice deleted.", "success");
      setConfirmDelete(null);
      onChange();
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(invoice: Invoice) {
    setBusyId(invoice.id);
    try {
      const { downloadInvoicePdf } = await import("@/lib/pdf");
      const totals = calculateInvoiceTotals(invoice);
      const upiUri = invoice.paymentInfo.showQrCode
        ? buildUpiUri(invoice.paymentInfo, invoice.business.name, totals.total, invoice.currency, invoice.invoiceNumber)
        : null;
      let qrDataUrl: string | null = null;
      if (upiUri) {
        const QRCode = (await import("qrcode")).default;
        qrDataUrl = await QRCode.toDataURL(upiUri, { margin: 1, width: 160 });
      }
      await downloadInvoicePdf(invoice, qrDataUrl);
    } catch {
      show("PDF generation failed.", "error");
    } finally {
      setBusyId(null);
    }
  }

  const statusOptions: Array<InvoiceStatus | "all"> = ["all", ...(Object.keys(STATUS_LABELS) as InvoiceStatus[])];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search by invoice #, customer name, or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
          />
        </div>
        <div className="flex gap-2">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode | "all")} className="w-28 sm:w-32">
            <option value="all">All currencies</option>
            {Array.from(new Set(invoices.map((i) => i.currency))).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-36 sm:w-40">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="highest">Highest amount</option>
            <option value="lowest">Lowest amount</option>
          </Select>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {statusOptions.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors",
                active ? "bg-ink text-white" : "bg-surface text-muted shadow-[0_2px_8px_rgba(20,60,45,0.05)] hover:text-foreground"
              )}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[22px] bg-surface shadow-[0_4px_14px_rgba(20,60,45,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-wide text-muted-soft">
                <th className="px-6 py-4">Client</th>
                <th className="px-4 py-4">Number</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Due Date</th>
                <th className="px-4 py-4 text-right">Amount</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => {
                const status = displayStatus(invoice);
                const total = calculateInvoiceTotals(invoice).total;
                const isBusy = busyId === invoice.id;
                const name = invoice.customer.name || "Customer";
                return (
                  <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-accent-soft/20">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold text-white"
                          style={{ background: avatarColor(name) }}
                        >
                          {initialsOf(name)}
                        </span>
                        <Link href={`/invoice/${invoice.id}`} className="font-bold text-foreground hover:text-accent">
                          {name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3.5 text-muted">{formatDate(invoice.invoiceDate, "DD MMM YYYY")}</td>
                    <td className="px-4 py-3.5 text-muted">{formatDate(invoice.dueDate, "DD MMM YYYY")}</td>
                    <td className="px-4 py-3.5 text-right font-display font-bold text-foreground">
                      {formatMoney(total, invoice.currency)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        <IconButton label="View / Edit" onClick={() => router.push(`/invoice/${invoice.id}`)} disabled={isBusy}>
                          <Pencil className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton label="Duplicate" onClick={() => handleDuplicate(invoice)} disabled={isBusy}>
                          <Copy className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton label="Download PDF" onClick={() => handleDownload(invoice)} disabled={isBusy}>
                          <Download className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton label="Print" onClick={() => router.push(`/invoice/${invoice.id}`)} disabled={isBusy}>
                          <Printer className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton label="Delete" onClick={() => setConfirmDelete(invoice)} disabled={isBusy} danger>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No invoices match your filters.</p>}
      </div>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete invoice?">
        <p className="text-sm text-muted">
          Are you sure you want to delete <strong>{confirmDelete?.invoiceNumber}</strong>? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={busyId === confirmDelete?.id}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-xl p-1.5 text-muted transition-colors hover:bg-black/[0.05] disabled:opacity-40",
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
