"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { listInvoices } from "@/services/invoices";
import type { Invoice } from "@/types/invoice";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { InvoicesTable } from "@/components/dashboard/InvoicesTable";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { show } = useToast();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  const load = useCallback(() => {
    listInvoices()
      .then(setInvoices)
      .catch((err) => show(err instanceof Error ? err.message : "Failed to load invoices.", "error"));
  }, [show]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/login?redirect=/dashboard");
      return;
    }
    load();
  }, [user, userLoading, router, load]);

  if (userLoading || !user || invoices === null) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted">Overview of your invoices.</p>
        </div>
        <Link href="/invoice/new">
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> Create Invoice
          </Button>
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-20 text-center">
          <FileText className="h-10 w-10 text-muted" />
          <h2 className="mt-4 text-base font-semibold">No invoices yet</h2>
          <p className="mt-1 text-sm text-muted">Create your first invoice in seconds.</p>
          <Link href="/invoice/new" className="mt-5">
            <Button>
              <Plus className="h-3.5 w-3.5" /> Create Invoice
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <StatsCards invoices={invoices} />
          <InvoicesTable invoices={invoices} onChange={load} />
        </div>
      )}
    </div>
  );
}
