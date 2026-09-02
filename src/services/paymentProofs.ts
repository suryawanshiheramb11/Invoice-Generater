import { createClient } from "@/lib/supabase/client";
import { ServiceError } from "@/services/invoices";

export type PaymentMethod = "upi" | "bank_transfer" | "cash" | "card" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

export interface PaymentProof {
  id: string;
  storagePath: string;
  method: PaymentMethod;
  note: string;
  submittedAt: string;
}

const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

/** Owner-side: lists payment proofs a client has submitted for one of their invoices. */
export async function listPaymentProofs(invoiceId: string): Promise<PaymentProof[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoice_payment_proofs")
    .select()
    .eq("invoice_id", invoiceId)
    .order("submitted_at", { ascending: false });
  if (error) throw new ServiceError(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    method: row.method as PaymentMethod,
    note: row.note,
    submittedAt: row.submitted_at,
  }));
}

/** Owner-side: a short-lived URL to view/download one proof (the bucket is private). */
export async function getPaymentProofUrl(storagePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(storagePath, 300);
  if (error) throw new ServiceError(error.message);
  return data.signedUrl;
}

export async function deletePaymentProof(id: string, storagePath: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("invoice_payment_proofs").delete().eq("id", id);
  if (error) throw new ServiceError(error.message);
  await supabase.storage.from("payment-proofs").remove([storagePath]);
}

/**
 * Client-side (unauthenticated): uploads a payment screenshot/receipt and marks the
 * invoice paid. The share token is the only credential — anyone holding the /share/[token]
 * link is treated as the invoice's recipient, same as for viewing the PDF itself.
 */
export async function submitPaymentProof(params: {
  token: string;
  invoiceId: string;
  file: File;
  method: PaymentMethod;
  note: string;
  partial: boolean;
}): Promise<void> {
  const { token, invoiceId, file, method, note, partial } = params;

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ServiceError("Proof must be a PNG, JPEG, WebP image, or PDF.");
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new ServiceError("File must be smaller than 10MB.");
  }

  const supabase = createClient();
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${invoiceId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) throw new ServiceError(uploadError.message);

  const { error } = await supabase.rpc("submit_payment_proof", {
    p_token: token,
    p_storage_path: path,
    p_method: method,
    p_note: note,
    p_partial: partial,
  });
  if (error) {
    await supabase.storage.from("payment-proofs").remove([path]);
    throw new ServiceError(error.message);
  }
}
