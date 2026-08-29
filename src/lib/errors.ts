/**
 * Translates raw database/network error text into a user-friendly message.
 * Our own ServiceError messages (e.g. "You must be signed in to save invoices.")
 * are already curated and pass through unchanged; this only rewrites the raw
 * Postgres/network error strings that would otherwise leak to the UI.
 */
export function friendlyErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/duplicate key value violates unique constraint/i.test(raw)) {
    if (/invoice_number/i.test(raw)) {
      return "This invoice number is already in use on your account. Please choose a different invoice number.";
    }
    return "This record already exists.";
  }
  if (/JWT|session|refresh token/i.test(raw)) {
    return "Your session has expired. Please log in again.";
  }
  if (/Failed to fetch|NetworkError|network/i.test(raw)) {
    return "Network error. Please check your connection and try again.";
  }
  if (/row-level security|permission denied/i.test(raw)) {
    return "You don't have permission to perform this action.";
  }

  return raw || "Something went wrong. Please try again.";
}
