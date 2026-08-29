import type { Invoice } from "@/types/invoice";

const KEY_PREFIX = "invoice-generator:draft:";
const LAST_DRAFT_KEY = "invoice-generator:last-draft-id";

/**
 * Convenience persistence for guests only. Authenticated users are persisted to the
 * hosted database (see src/services/invoices.ts) — this is never the primary store for them.
 */
export function saveDraft(invoice: Invoice) {
  if (typeof window === "undefined") return;
  try {
    const id = invoice.id ?? "draft";
    window.localStorage.setItem(KEY_PREFIX + id, JSON.stringify(invoice));
    window.localStorage.setItem(LAST_DRAFT_KEY, id);
  } catch {
    // Storage may be unavailable (private browsing, quota) — safe to ignore for a convenience feature.
  }
}

export function loadDraft(id = "draft"): Invoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as Invoice) : null;
  } catch {
    return null;
  }
}

export function clearDraft(id = "draft") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + id);
  } catch {
    // ignore
  }
}
