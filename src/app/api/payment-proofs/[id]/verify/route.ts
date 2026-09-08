import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentProof } from "@/lib/paymentVerification";

// tesseract.js needs Node APIs (worker_threads, fs) that aren't available on the edge runtime.
export const runtime = "nodejs";

/**
 * Runs the local-OCR check (step 1 of the two-step verification) against one payment
 * proof and stores the verdict. Called two ways:
 *  - by the /pay/[id] (or /share/[token]) page right after a client submits proof (passes
 *    the invoice id — the same credential that already let them submit the proof itself)
 *  - by the owner's dashboard, to re-run the check on demand (uses their session)
 *
 * OCR here is genuinely expensive — tesseract, on a file up to 10MB, inside a serverless
 * function that bills by the second. The anonymous path therefore runs at most once per
 * proof (the single fire-and-forget call that legitimately follows a submission); every
 * re-run after that requires the invoice owner's session. Without that, anyone holding a
 * proof id and its invoice id — which is exactly what a payer's own browser receives —
 * could sit in a loop burning CPU indefinitely.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: proofId } = await params;
  const body = await request.json().catch(() => ({}));
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : null;

  if (!rateLimitOk(clientKey(request))) {
    return NextResponse.json({ error: "Too many verification requests. Try again shortly." }, { status: 429 });
  }

  const admin = createAdminClient();

  const { data: proof, error: proofError } = await admin
    .from("invoice_payment_proofs")
    .select("id, invoice_id, storage_path, ai_checked_at")
    .eq("id", proofId)
    .maybeSingle();
  if (proofError || !proof) {
    return NextResponse.json({ error: "Proof not found." }, { status: 404 });
  }
  if (!proof.storage_path) {
    return NextResponse.json({ error: "This proof has no attached file to verify." }, { status: 400 });
  }

  // The file is fetched below with the service-role key, which bypasses storage RLS
  // entirely — so the path has to be re-checked here rather than trusted from the row.
  // submit_payment_proof enforces this prefix too (migration 0011); this covers rows
  // written before that landed, and any future caller that reaches the table another way.
  if (!proof.storage_path.startsWith(`${proof.invoice_id}/`)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const isOwner = await sessionOwnsInvoice(proof.invoice_id);
  // A matching invoice id is the anonymous payer's credential, but it only buys the first
  // check on a given proof. After that, re-running is an owner-only action.
  const authorized = isOwner || (invoiceId === proof.invoice_id && !proof.ai_checked_at);
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

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const hits = new Map<string, number[]>();

/**
 * Per-instance throttle. A serverless deployment runs many instances, so this is a ceiling
 * on how fast one caller can go *per instance*, not a global quota — the real bound on
 * abuse is the once-per-proof rule above. It's here to blunt the trivial single-client
 * hammering case, and it's deliberately dependency-free; a distributed limiter (Upstash,
 * Vercel KV) would be the upgrade if this endpoint ever gets genuinely attacked.
 */
function rateLimitOk(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  // Bound the map so a stream of distinct keys can't grow it without limit.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) hits.delete(k);
    }
  }
  return true;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
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
