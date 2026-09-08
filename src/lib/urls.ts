/**
 * Normalizes a user-supplied link (the invoice's "Payment Link", a business website) into
 * something safe to put in an href, or null if it can't be.
 *
 * The important case is scheme filtering. React does not block `javascript:` in an href —
 * it warns in development and renders it anyway — so an invoice owner could set their
 * payment link to `javascript:...` and have it execute on our origin in *their client's*
 * browser when that client opens /pay/[id]. `data:` and `vbscript:` are refused for the
 * same reason. Anything without a scheme is treated as https, since people habitually
 * type "www.example.com".
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // A leading scheme is anything up to the first colon that looks like a URI scheme.
  // Without one, assume the user typed a bare host.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}
