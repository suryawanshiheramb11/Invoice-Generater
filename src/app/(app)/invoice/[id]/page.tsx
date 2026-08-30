"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { InvoiceEditor } from "@/components/invoice/InvoiceEditor";
import { useUser } from "@/hooks/useUser";
import { getInvoice } from "@/services/invoices";
import { useToast } from "@/components/ui/Toast";
import type { Invoice } from "@/types/invoice";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { show } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace(`/login?redirect=/invoice/${id}`);
      return;
    }
    let cancelled = false;
    getInvoice(id)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setNotFound(true);
          return;
        }
        setInvoice(result);
      })
      .catch(() => {
        if (!cancelled) {
          show("Could not load this invoice.", "error");
          setNotFound(true);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, userLoading]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-lg font-semibold">Invoice not found</h1>
        <p className="mt-2 text-sm text-muted">
          This invoice doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return <InvoiceEditor invoiceId={id} initialInvoice={invoice} />;
}
