import { createClient } from "@/lib/supabase/client";
import { ServiceError, updateInvoiceStatus } from "@/services/invoices";

export type PaymentMethod = "upi" | "bank_transfer" | "cash" | "card" | "other";
export type AiVerificationStatus = "pending" | "match" | "mismatch" | "error" | "not_applicable";
export type OwnerReviewStatus = "pending" | "approved" | "rejected";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

export interface PaymentProof {
  id: string;
  invoiceId: string;
  storagePath: string | null;
  method: PaymentMethod;
  note: string;
  submittedAt: string;
  recordedBy: "client" | "owner";
  aiStatus: AiVerificationStatus;
  aiNotes: string;
  ownerStatus: OwnerReviewStatus;
  highPriority: boolean;
  amount: number | null;
}

const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

function mapProof(row: {
  id: string;
  invoice_id: string;
  storage_path: string | null;
  method: string;
  note: string;
  submitted_at: string;
  recorded_by: string;
  ai_status: string;
  ai_notes: string;
  owner_status: string;
  high_priority: boolean;
  amount: number | null;
}): PaymentProof {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    storagePath: row.storage_path,
    method: row.method as PaymentMethod,
    note: row.note,
    submittedAt: row.submitted_at,
    recordedBy: row.recorded_by as "client" | "owner",
    aiStatus: row.ai_status as AiVerificationStatus,
    aiNotes: row.ai_notes,
    ownerStatus: row.owner_status as OwnerReviewStatus,
    highPriority: row.high_priority,
    amount: row.amount,
  };
}

/** Owner-side: lists payment proofs (client-submitted and owner-recorded) for one of their invoices. */
export async function listPaymentProofs(invoiceId: string): Promise<PaymentProof[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoice_payment_proofs")
    .select()
    .eq("invoice_id", invoiceId)
    .order("submitted_at", { ascending: false });
  if (error) throw new ServiceError(error.message);

  return (data ?? []).map(mapProof);
}

/** Owner-side: a short-lived URL to view/download one proof (the bucket is private). */
export async function getPaymentProofUrl(storagePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(storagePath, 300);
  if (error) throw new ServiceError(error.message);
  return data.signedUrl;
}

export async function deletePaymentProof(id: string, storagePath: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("invoice_payment_proofs").delete().eq("id", id);
  if (error) throw new ServiceError(error.message);
  if (storagePath) await supabase.storage.from("payment-proofs").remove([storagePath]);
}

/**
 * Client-side (unauthenticated): uploads a payment screenshot/receipt and marks the
 * invoice paid. The invoice id is the only credential — it's unguessable and already
 * the trust boundary for the payment-proofs storage bucket (see migration 0006), so
 * anyone holding it (via the PDF, /pay/[id], or a /share/[token] link) is treated as
 * the invoice's recipient, same as for viewing the PDF itself.
 *
 * After the proof is recorded, this kicks off the local-OCR verification check
 * (step 1 of 2 — the owner still always reviews manually) in the background. That
 * request is best-effort: if it fails (e.g. the client closes the tab immediately),
 * the proof simply sits at ai_status "pending" until the owner re-runs the check
 * from the dashboard, so nothing about payment status depends on it succeeding.
 */
export async function submitPaymentProof(params: {
  invoiceId: string;
  file: File;
  method: PaymentMethod;
  note: string;
  partial: boolean;
  amount: number;
}): Promise<void> {
  const { invoiceId, file, method, note, partial, amount } = params;

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ServiceError("Proof must be a PNG, JPEG, WebP image, or PDF.");
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new ServiceError("File must be smaller than 10MB.");
  }
  if (!(amount > 0)) {
    throw new ServiceError("Enter how much you're paying.");
  }

  const supabase = createClient();
  const extension = file.name.split(".").pop() || "jpg";
  const path = `${invoiceId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, file, {
    contentType: file.type,
  });
  if (uploadError) throw new ServiceError(uploadError.message);

  const { data: proofId, error } = await supabase.rpc("submit_payment_proof", {
    p_invoice_id: invoiceId,
    p_storage_path: path,
    p_method: method,
    p_note: note,
    p_partial: partial,
    p_amount: amount,
  });
  if (error) {
    await supabase.storage.from("payment-proofs").remove([path]);
    throw new ServiceError(error.message);
  }

  if (proofId) {
    fetch(`/api/payment-proofs/${proofId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    }).catch(() => {});
  }
}

/**
 * Owner-side: records a payment that never went through the client form at all —
 * cash handed over in person, a bank transfer the client never bothered to log. There's
 * no file to OCR-check, so this is auto-approved (the owner is asserting it themselves).
 */
export async function recordManualPayment(params: {
  invoiceId: string;
  method: PaymentMethod;
  note: string;
  partial: boolean;
  amount: number;
}): Promise<void> {
  const { invoiceId, method, note, partial, amount } = params;
  if (!(amount > 0)) throw new ServiceError("Enter how much was paid.");
  const supabase = createClient();
  const { error } = await supabase.from("invoice_payment_proofs").insert({
    invoice_id: invoiceId,
    storage_path: null,
    method,
    note,
    recorded_by: "owner",
    ai_status: "not_applicable",
    owner_status: "approved",
    owner_reviewed_at: new Date().toISOString(),
    amount,
  });
  if (error) throw new ServiceError(error.message);
  await updateInvoiceStatus(invoiceId, partial ? "partially_paid" : "paid");
}

/**
 * Owner-side: step 2 of the two-step verification — approve or reject a client-submitted
 * proof after (optionally) looking at the OCR result and the attached file themselves.
 * Rejecting reverts the invoice to "sent", since the payment it was based on didn't hold up.
 */
export async function reviewPaymentProof(params: {
  proofId: string;
  invoiceId: string;
  approve: boolean;
}): Promise<void> {
  const { proofId, invoiceId, approve } = params;
  const supabase = createClient();
  const { error } = await supabase
    .from("invoice_payment_proofs")
    .update({ owner_status: approve ? "approved" : "rejected", owner_reviewed_at: new Date().toISOString() })
    .eq("id", proofId);
  if (error) throw new ServiceError(error.message);
  if (!approve) await updateInvoiceStatus(invoiceId, "sent");
}

/** Owner-side: re-runs the local-OCR check on demand (e.g. it never ran, or errored out). */
export async function rerunVerification(proofId: string): Promise<void> {
  const res = await fetch(`/api/payment-proofs/${proofId}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ServiceError(body.error || "Verification failed.");
  }
}
