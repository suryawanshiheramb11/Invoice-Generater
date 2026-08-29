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

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search by invoice #, customer name, or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus | "all")} className="sm:w-44">
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode | "all")} className="sm:w-32">
          <option value="all">All currencies</option>
          {Array.from(new Set(invoices.map((i) => i.currency))).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="sm:w-40">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest">Highest amount</option>
          <option value="lowest">Lowest amount</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-black/[0.02] text-left text-xs font-medium uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((invoice) => {
              const status = displayStatus(invoice);
              const total = calculateInvoiceTotals(invoice).total;
              const isBusy = busyId === invoice.id;
              return (
                <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-black/[0.015]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/invoice/${invoice.id}`} className="hover:text-accent hover:underline">
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{invoice.customer.name || "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(invoice.invoiceDate, "DD MMM YYYY")}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(invoice.dueDate, "DD MMM YYYY")}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(total, invoice.currency)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
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
      className={
        "rounded-md p-1.5 text-muted transition-colors hover:bg-black/[0.05] disabled:opacity-40 " +
        (danger ? "hover:bg-danger-soft hover:text-danger" : "hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
