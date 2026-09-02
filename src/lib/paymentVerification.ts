import { createWorker } from "tesseract.js";
import { tmpdir } from "node:os";

/**
 * Verifies a client-submitted payment proof (a UPI/bank-transfer screenshot or a photo
 * of a receipt) against what the invoice actually expects, using local OCR only —
 * no third-party AI vision API, no API key, no per-call cost.
 *
 * This is step 1 of a two-step process: it flags an amount that doesn't match, or an
 * image it can't read at all, as needing attention. It never *approves* a payment on
 * its own — the invoice owner always does a manual review (step 2) before anything is
 * treated as fully verified. Treat this as a triage aid, not a fraud-proof check: OCR
 * can misread a genuine screenshot, and a doctored image can still say the right number.
 */

export type VerificationStatus = "match" | "mismatch" | "error" | "not_applicable";

export interface VerificationInput {
  /** Raw file bytes — a screenshot/photo. PDFs aren't OCR'd (see NOTE below) and always come back "error". */
  fileBytes: Uint8Array;
  contentType: string;
  expectedAmount: number;
  currencySymbol: string;
  /** e.g. "someone@okhdfcbank" — only the part before '@' is matched, since apps often mask the rest. */
  upiId?: string;
  invoiceNumber?: string;
  payeeName?: string;
}

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number; // 0-100, informational only — the owner's manual review is what actually counts
  notes: string;
  extractedAmounts: number[];
  rawTextPreview: string;
}

const AMOUNT_TOLERANCE_RATIO = 0.005; // 0.5% — enough slack for OCR noise on the last digit
const AMOUNT_TOLERANCE_MIN = 1; // absolute floor so tiny invoices aren't overly strict

function amountsMatch(a: number, b: number): boolean {
  const tolerance = Math.max(AMOUNT_TOLERANCE_MIN, a * AMOUNT_TOLERANCE_RATIO);
  return Math.abs(a - b) <= tolerance;
}

/** Pulls every plausible money amount out of OCR'd receipt/screenshot text. */
function extractAmounts(text: string): number[] {
  const found = new Set<number>();
  // ₹1,234.56 / Rs. 1234 / INR 1,234 / plain 1,234.56 with a decimal component —
  // covers the formats UPI apps and bank SMS/receipts actually use.
  const patterns = [
    /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?)\b/g,
    /\b(\d+\.\d{2})\b/g,
  ];
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const cleaned = m[1].replace(/,/g, "");
      const value = parseFloat(cleaned);
      if (Number.isFinite(value) && value > 0) found.add(Math.round(value * 100) / 100);
    }
  }
  return [...found];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Runs OCR and rule-based matching. Safe to call from a server route (Node runtime —
 * tesseract.js needs Node APIs, so it will not run on the edge runtime) or a standalone
 * script; it has no side effects of its own (callers persist the result).
 */
export async function verifyPaymentProof(input: VerificationInput): Promise<VerificationResult> {
  const { fileBytes, contentType, expectedAmount, upiId, invoiceNumber, payeeName } = input;

  // NOTE: PDF receipts aren't rasterized/OCR'd here — pulling that in reliably needs a
  // PDF-to-image step with native deps that are awkward in serverless environments.
  // Surfacing them as "error" (rather than silently skipping) is deliberate: it routes
  // them into the high-priority review queue instead of a script result nobody asked for.
  if (contentType === "application/pdf") {
    return {
      status: "error",
      confidence: 0,
      notes: "PDF proofs aren't scanned automatically — please review the attachment yourself.",
      extractedAmounts: [],
      rawTextPreview: "",
    };
  }

  let text: string;
  try {
    // cachePath keeps tesseract.js's downloaded language data out of the project
    // directory (it defaults to the current working directory otherwise).
    const worker = await createWorker("eng", undefined, { cachePath: tmpdir() });
    try {
      const { data } = await worker.recognize(Buffer.from(fileBytes));
      text = data.text;
    } finally {
      await worker.terminate();
    }
  } catch (err) {
    return {
      status: "error",
      confidence: 0,
      notes: `OCR failed to process the image (${err instanceof Error ? err.message : "unknown error"}).`,
      extractedAmounts: [],
      rawTextPreview: "",
    };
  }

  const normalized = normalize(text);
  const extractedAmounts = extractAmounts(text);

  const amountMatch = extractedAmounts.some((a) => amountsMatch(a, expectedAmount));
  const amountMismatch = extractedAmounts.length > 0 && !amountMatch;

  const upiHandle = upiId?.split("@")[0]?.toLowerCase().trim();
  const upiMatch = Boolean(upiHandle && upiHandle.length >= 3 && normalized.includes(upiHandle));

  const invoiceDigits = invoiceNumber?.replace(/\D/g, "");
  const invoiceNumberMatch = Boolean(
    invoiceNumber && (normalized.includes(invoiceNumber.toLowerCase()) || (invoiceDigits && invoiceDigits.length >= 3 && normalized.includes(invoiceDigits)))
  );

  const payeeMatch = Boolean(
    payeeName && payeeName.trim().length >= 3 && normalized.includes(payeeName.toLowerCase().trim())
  );

  const rawTextPreview = text.trim().slice(0, 400);

  if (extractedAmounts.length === 0) {
    return {
      status: "error",
      confidence: 20,
      notes: "OCR couldn't find a clear amount in this image — needs manual review.",
      extractedAmounts,
      rawTextPreview,
    };
  }

  if (amountMismatch) {
    return {
      status: "mismatch",
      confidence: 70,
      notes: `OCR read ${extractedAmounts.map((a) => a.toFixed(2)).join(", ")} in this image, which doesn't match the invoice total of ${expectedAmount.toFixed(2)}.`,
      extractedAmounts,
      rawTextPreview,
    };
  }

  const corroborations = [upiMatch, invoiceNumberMatch, payeeMatch].filter(Boolean).length;
  const confidence = Math.min(95, 60 + corroborations * 12);
  const signals = [
    upiMatch && "the UPI ID",
    invoiceNumberMatch && "the invoice number",
    payeeMatch && "the payee name",
  ].filter(Boolean);

  return {
    status: "match",
    confidence,
    notes:
      signals.length > 0
        ? `Amount matches (${expectedAmount.toFixed(2)}), and OCR also found ${signals.join(" and ")} in the image.`
        : `Amount matches (${expectedAmount.toFixed(2)}), but no other identifying detail (UPI ID, invoice number, payee name) was found in the image — worth a quick look.`,
    extractedAmounts,
    rawTextPreview,
  };
}
