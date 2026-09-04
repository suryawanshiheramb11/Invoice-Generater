import type { NextConfig } from "next";

// React/Next dev mode uses eval() for hot-reload debugging (never in production
// builds), so only allow plain eval outside production. 'wasm-unsafe-eval' is
// needed in both: @react-pdf/renderer's layout engine (yoga-layout) compiles to
// WebAssembly, which Chrome gates separately from 'unsafe-eval'.
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'";

const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  // yoga-layout (used by @react-pdf/renderer to lay out PDFs) runs its WASM
  // module off a worker it spins up from a blob: URL — without this, the
  // browser silently blocks the worker and PDF generation (Share/Download/
  // Save-PDF) hangs forever instead of erroring.
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  // 'blob:' + 'data:' here for the same reason as worker-src above: the wasm
  // module is embedded as a data: URI and yoga-layout fetch()es it to get the
  // bytes, which connect-src (not img-src) gates.
  "connect-src 'self' blob: data: https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  // tesseract.js resolves its worker-script path relative to its own package directory
  // at runtime — bundling it (the default) breaks that resolution under both webpack and
  // Turbopack. Keeping it external makes Node require() it normally instead.
  serverExternalPackages: ["tesseract.js"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
