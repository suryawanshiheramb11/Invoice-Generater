/**
 * Only ever allow same-origin, relative redirect targets from user-controlled
 * query params (?next=, ?redirect=). Rejects absolute URLs and protocol-relative
 * ("//host/...") values, which are the two shapes used for open-redirect / OAuth
 * phishing attacks.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return fallback;
  return value;
}
