import { createClient } from "@/lib/supabase/client";
import { ServiceError } from "@/services/invoices";
import type { Invoice } from "@/types/invoice";

export type PdfRetention = "24h" | "7d";

export interface PdfExport {
  id: string;
  shareToken: string;
  shareUrl: string;
  storagePath: string;
  createdAt: string;
  expiresAt: string;
}

function retentionMs(retention: PdfRetention): number {
  return retention === "7d" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

/** Generates a PDF, uploads it, and records a share link that expires after the chosen retention. */
export async function saveInvoicePdf(
  invoice: Invoice,
  qrDataUrl: string | null,
  retention: PdfRetention
): Promise<PdfExport> {
  if (!invoice.id) throw new ServiceError("Save the invoice before saving a PDF snapshot.");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ServiceError("You must be signed in to save a PDF.");

  // Best-effort sweep of anything already expired; never block saving a new export on this.
  await supabase.rpc("cleanup_expired_pdf_exports").then(
    () => {},
    () => {}
  );

  const { generatePdfFile } = await import("@/lib/pdf");
  const file = await generatePdfFile(invoice, qrDataUrl);
  const shareToken = crypto.randomUUID().replace(/-/g, "");
  const path = `${user.id}/${shareToken}.pdf`;

  const { error: uploadError } = await supabase.storage.from("invoice-pdfs").upload(path, file, {
    contentType: "application/pdf",
  });
  if (uploadError) throw new ServiceError(uploadError.message);

  const expiresAt = new Date(Date.now() + retentionMs(retention)).toISOString();

  const { data, error } = await supabase
    .from("invoice_pdf_exports")
    .insert({
      invoice_id: invoice.id,
      user_id: user.id,
      storage_path: path,
      share_token: shareToken,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from("invoice-pdfs").remove([path]);
    throw new ServiceError(error.message);
  }

  return {
    id: data.id,
    shareToken: data.share_token,
    shareUrl: `${window.location.origin}/share/${data.share_token}`,
    storagePath: data.storage_path,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

export async function listPdfExports(invoiceId: string): Promise<PdfExport[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoice_pdf_exports")
    .select()
    .eq("invoice_id", invoiceId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new ServiceError(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    shareToken: row.share_token,
    shareUrl: `${window.location.origin}/share/${row.share_token}`,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function deletePdfExport(id: string, storagePath: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("invoice_pdf_exports").delete().eq("id", id);
  if (error) throw new ServiceError(error.message);
  await supabase.storage.from("invoice-pdfs").remove([storagePath]);
}
