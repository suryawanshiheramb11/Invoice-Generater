/**
 * Standalone script: runs the same local-OCR verification the app runs automatically
 * (src/lib/paymentVerification.ts) against one payment proof. No third-party AI API, no
 * API key — Tesseract OCR runs entirely on this machine.
 *
 * Two ways to run it:
 *
 *   1. Against a proof already in the database (looks up the invoice's expected amount/
 *      UPI ID/invoice number itself, downloads the image from the private `payment-proofs`
 *      storage bucket, and — unless --dry-run is passed — writes the verdict back so it
 *      shows up in the dashboard exactly like the automatic check does):
 *
 *        npm run verify-proof -- --proof-id <uuid>
 *        npm run verify-proof -- --proof-id <uuid> --dry-run
 *
 *      Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 *      (the service role key is this project's own Supabase secret — Project Settings ->
 *      API — not a paid AI vision credential).
 *
 *   2. Against a local image file, with the expected details passed in by hand (useful
 *      for testing, or for a proof that never went through the app at all):
 *
 *        npm run verify-proof -- --file ./receipt.jpg --amount 5000 \
 *          --upi-id someone@okhdfcbank --invoice-number INV-2026-0007
 */
import { readFile } from "node:fs/promises";
import { verifyPaymentProof } from "../src/lib/paymentVerification";

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function contentTypeFromFilename(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function printResult(label: string, result: Awaited<ReturnType<typeof verifyPaymentProof>>) {
  console.log(`\n${label}`);
  console.log(`  status:     ${result.status}`);
  console.log(`  confidence: ${result.confidence}`);
  console.log(`  notes:      ${result.notes}`);
  if (result.extractedAmounts.length > 0) {
    console.log(`  amounts seen in image: ${result.extractedAmounts.join(", ")}`);
  }
  if (result.rawTextPreview) {
    console.log(`  OCR text preview: ${JSON.stringify(result.rawTextPreview)}`);
  }
}

async function runAgainstFile(args: Record<string, string | boolean>) {
  const filePath = args.file as string;
  const amount = parseFloat(args.amount as string);
  if (!filePath || !Number.isFinite(amount)) {
    console.error("Usage: --file <path> --amount <number> [--upi-id <id>] [--invoice-number <no>] [--payee <name>]");
    process.exit(1);
  }

  const bytes = await readFile(filePath);
  const result = await verifyPaymentProof({
    fileBytes: new Uint8Array(bytes),
    contentType: contentTypeFromFilename(filePath),
    expectedAmount: amount,
    currencySymbol: (args.currency as string) || "",
    upiId: args["upi-id"] as string | undefined,
    invoiceNumber: args["invoice-number"] as string | undefined,
    payeeName: args.payee as string | undefined,
  });

  printResult(filePath, result);
}

async function runAgainstProofId(args: Record<string, string | boolean>) {
  const proofId = args["proof-id"] as string;
  const dryRun = Boolean(args["dry-run"]);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment first.");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey);

  const { data: proof, error: proofError } = await supabase
    .from("invoice_payment_proofs")
    .select("id, invoice_id, storage_path, method")
    .eq("id", proofId)
    .single();
  if (proofError || !proof) {
    console.error(`Couldn't find proof ${proofId}: ${proofError?.message ?? "not found"}`);
    process.exit(1);
  }
  if (!proof.storage_path) {
    console.error("This proof has no attached file (it was recorded manually by the owner) — nothing to verify.");
    process.exit(1);
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("invoice_number, invoice_data, total")
    .eq("id", proof.invoice_id)
    .single();
  if (invoiceError || !invoice) {
    console.error(`Couldn't find invoice ${proof.invoice_id}: ${invoiceError?.message ?? "not found"}`);
    process.exit(1);
  }

  const invoiceData = invoice.invoice_data as {
    paymentInfo?: { upiId?: string };
    business?: { name?: string };
  };
  const expectedAmount = parseFloat((args.amount as string) || "") || invoice.total;

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("payment-proofs")
    .download(proof.storage_path);
  if (downloadError || !fileData) {
    console.error(`Couldn't download the proof file: ${downloadError?.message ?? "unknown error"}`);
    process.exit(1);
  }
  const bytes = new Uint8Array(await fileData.arrayBuffer());

  const result = await verifyPaymentProof({
    fileBytes: bytes,
    contentType: fileData.type || contentTypeFromFilename(proof.storage_path),
    expectedAmount,
    currencySymbol: "",
    upiId: invoiceData.paymentInfo?.upiId,
    invoiceNumber: invoice.invoice_number,
    payeeName: invoiceData.business?.name,
  });

  printResult(`Proof ${proofId} (invoice ${invoice.invoice_number})`, result);

  if (!dryRun) {
    const { error: updateError } = await supabase
      .from("invoice_payment_proofs")
      .update({ ai_status: result.status, ai_notes: result.notes, ai_checked_at: new Date().toISOString() })
      .eq("id", proofId);
    if (updateError) {
      console.error(`\nVerified, but failed to save the result: ${updateError.message}`);
      process.exit(1);
    }
    console.log("\nSaved — the owner dashboard will show this result.");
  } else {
    console.log("\n--dry-run: not saved.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args["proof-id"]) {
    await runAgainstProofId(args);
  } else if (args.file) {
    await runAgainstFile(args);
  } else {
    console.error(
      "Usage:\n  npm run verify-proof -- --proof-id <uuid> [--amount <number>] [--dry-run]\n  npm run verify-proof -- --file <path> --amount <number> [--upi-id <id>] [--invoice-number <no>] [--payee <name>]"
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
