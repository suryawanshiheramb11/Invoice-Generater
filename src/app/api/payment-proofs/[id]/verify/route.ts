import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentProof } from "@/lib/paymentVerification";

// tesseract.js needs Node APIs (worker_threads, fs) that aren't available on the edge runtime.
export const runtime = "nodejs";

/**
 * Runs the local-OCR check (step 1 of the two-step verification) against one payment
 * proof and stores the verdict. Called two ways, both already-authorized elsewhere:
 *  - by the /pay/[id] (or /share/[token]) page right after a client submits proof (passes
 *    the invoice id — the same credential that already let them submit the proof itself)
 *  - by the owner's dashboard, to re-run the check on demand (uses their session)
 * Either way this only ever writes an advisory ai_status/ai_notes onto a proof row —
 * it never changes the invoice's paid/unpaid status, so getting the auth check slightly
 * wrong here has no security consequence beyond "the wrong person saw an OCR result."
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: proofId } = await params;
  const body = await request.json().catch(() => ({}));
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : null;

  const admin = createAdminClient();

  const { data: proof, error: proofError } = await admin
    .from("invoice_payment_proofs")
    .select("id, invoice_id, storage_path")
    .eq("id", proofId)
    .maybeSingle();
  if (proofError || !proof) {
    return NextResponse.json({ error: "Proof not found." }, { status: 404 });
  }
  if (!proof.storage_path) {
    return NextResponse.json({ error: "This proof has no attached file to verify." }, { status: 400 });
  }

  const authorized = invoiceId ? invoiceId === proof.invoice_id : await sessionOwnsInvoice(proof.invoice_id);
  if (!authorized) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("invoice_number, invoice_data, total")
    .eq("id", proof.invoice_id)
    .single();
  if (invoiceError || !invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const { data: fileData, error: downloadError } = await admin.storage
    .from("payment-proofs")
    .download(proof.storage_path);
  if (downloadError || !fileData) {
    return NextResponse.json({ error: "Could not read the proof file." }, { status: 500 });
  }

  const invoiceData = invoice.invoice_data as { paymentInfo?: { upiId?: string }; business?: { name?: string } };
  const result = await verifyPaymentProof({
    fileBytes: new Uint8Array(await fileData.arrayBuffer()),
    contentType: fileData.type || "application/octet-stream",
    expectedAmount: invoice.total,
    currencySymbol: "",
    upiId: invoiceData.paymentInfo?.upiId,
    invoiceNumber: invoice.invoice_number,
    payeeName: invoiceData.business?.name,
  });

  const { error: updateError } = await admin
    .from("invoice_payment_proofs")
    .update({ ai_status: result.status, ai_notes: result.notes, ai_checked_at: new Date().toISOString() })
    .eq("id", proofId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ status: result.status, notes: result.notes, confidence: result.confidence });
}

async function sessionOwnsInvoice(invoiceId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("invoices").select("id").eq("id", invoiceId).eq("user_id", user.id).maybeSingle();
  return Boolean(data);
}
