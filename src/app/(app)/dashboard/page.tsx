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
import { friendlyErrorMessage } from "@/lib/errors";

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { show } = useToast();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  const load = useCallback(() => {
    listInvoices()
      .then(setInvoices)
      .catch((err) => show(friendlyErrorMessage(err), "error"));
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

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const displayName = user.email?.split("@")[0] ?? "there";

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">{greeting}</p>
          <h1 className="mt-1.5 font-display text-3xl font-extrabold tracking-tight text-foreground capitalize">
            {displayName}
          </h1>
        </div>
        <Link href="/invoice/new">
          <Button variant="secondary">
            <Plus className="h-4 w-4" /> Create invoice
          </Button>
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[26px] bg-surface px-6 py-20 text-center shadow-[0_4px_14px_rgba(20,60,45,0.06)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-success">
            <FileText className="h-7 w-7" />
          </span>
          <h2 className="mt-5 font-display text-lg font-bold">No invoices yet</h2>
          <p className="mt-1 text-sm text-muted">Create your first invoice in seconds.</p>
          <Link href="/invoice/new" className="mt-6">
            <Button>
              <Plus className="h-4 w-4" /> Create Invoice
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
