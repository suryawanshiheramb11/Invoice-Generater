import type { ReactNode } from "react";
import QRCode from "qrcode";
import type { CurrencyCode } from "@/types/invoice";

/**
 * Real, brand-colored marks for Google Pay/PhonePe/Paytm (path data from Simple Icons,
 * MIT-licensed — https://simpleicons.org, verified against simple-icons/simple-icons on
 * GitHub) rendered in each brand's actual color, instead of a generic icon. BHIM, Amazon
 * Pay, and CRED don't have a verified open-source mark available the same way, so those
 * three render as a plain text badge in the brand's well-known color rather than guessing
 * at logo artwork that might not match the real thing.
 */
function GooglePayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#3C4043" aria-hidden="true">
      <path d="M3.963 7.235A3.963 3.963 0 00.422 9.419a3.963 3.963 0 000 3.559 3.963 3.963 0 003.541 2.184c1.07 0 1.97-.352 2.627-.957.748-.69 1.18-1.71 1.18-2.916a4.722 4.722 0 00-.07-.806H3.964v1.526h2.14a1.835 1.835 0 01-.79 1.205c-.356.241-.814.379-1.35.379-1.034 0-1.911-.697-2.225-1.636a2.375 2.375 0 010-1.517c.314-.94 1.191-1.636 2.225-1.636a2.152 2.152 0 011.52.594l1.132-1.13a3.808 3.808 0 00-2.652-1.033zm6.501.55v6.9h.886V11.89h1.465c.603 0 1.11-.196 1.522-.588a1.911 1.911 0 00.635-1.464 1.92 1.92 0 00-.635-1.456 2.125 2.125 0 00-1.522-.598zm2.427.85a1.156 1.156 0 01.823.365 1.176 1.176 0 010 1.686 1.171 1.171 0 01-.877.357H11.35V8.635h1.487a1.156 1.156 0 01.054 0zm4.124 1.175c-.842 0-1.477.308-1.907.925l.781.491c.288-.417.68-.626 1.175-.626a1.255 1.255 0 01.856.323 1.009 1.009 0 01.366.785v.202c-.34-.193-.774-.289-1.3-.289-.617 0-1.11.145-1.479.434-.37.288-.554.677-.554 1.165a1.476 1.476 0 00.525 1.156c.35.308.785.463 1.305.463.61 0 1.098-.27 1.465-.81h.038v.655h.848v-2.909c0-.61-.19-1.09-.568-1.44-.38-.35-.896-.525-1.551-.525zm2.263.154l1.946 4.422-1.098 2.38h.915L24 9.963h-.965l-1.368 3.391h-.02l-1.406-3.39zm-2.146 2.368c.494 0 .88.11 1.156.33 0 .372-.147.696-.44.973a1.413 1.413 0 01-.997.414 1.081 1.081 0 01-.69-.232.708.708 0 01-.293-.578c0-.257.12-.47.363-.647.24-.173.54-.26.9-.26Z" />
    </svg>
  );
}

function PhonePeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#5F259F" aria-hidden="true">
      <path d="M10.206 9.941h2.949v4.692c-.402.201-.938.268-1.34.268-1.072 0-1.609-.536-1.609-1.743V9.941zm13.47 4.816c-1.523 6.449-7.985 10.442-14.433 8.919C2.794 22.154-1.199 15.691.324 9.243 1.847 2.794 8.309-1.199 14.757.324c6.449 1.523 10.442 7.985 8.919 14.433zm-6.231-5.888a.887.887 0 0 0-.871-.871h-1.609l-3.686-4.222c-.335-.402-.871-.536-1.407-.402l-1.274.401c-.201.067-.268.335-.134.469l4.021 3.82H6.386c-.201 0-.335.134-.335.335v.67c0 .469.402.871.871.871h.938v3.217c0 2.413 1.273 3.82 3.418 3.82.67 0 1.206-.067 1.877-.335v2.145c0 .603.469 1.072 1.072 1.072h.938a.432.432 0 0 0 .402-.402V9.874h1.542c.201 0 .335-.134.335-.335v-.67z" />
    </svg>
  );
}

function PaytmIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#00BAF2" aria-hidden="true">
      <path d="M15.85 8.167a.204.204 0 0 0-.04.004c-.68.19-.543 1.148-1.781 1.23h-.12a.23.23 0 0 0-.052.005h-.001a.24.24 0 0 0-.184.235v1.09c0 .134.106.241.237.241h.645v4.623c0 .132.104.238.233.238h1.058a.236.236 0 0 0 .233-.238v-4.623h.6c.13 0 .236-.107.236-.241v-1.09a.239.239 0 0 0-.236-.24h-.612V8.386a.218.218 0 0 0-.216-.22zm4.225 1.17c-.398 0-.762.15-1.042.395v-.124a.238.238 0 0 0-.234-.224h-1.07a.24.24 0 0 0-.236.242v5.92a.24.24 0 0 0 .236.242h1.07c.12 0 .217-.091.233-.209v-4.25a.393.393 0 0 1 .371-.408h.196a.41.41 0 0 1 .226.09.405.405 0 0 1 .145.319v4.074l.004.155a.24.24 0 0 0 .237.241h1.07a.239.239 0 0 0 .235-.23l-.001-4.246c0-.14.062-.266.174-.34a.419.419 0 0 1 .196-.068h.198c.23.02.37.2.37.408.005 1.396.004 2.8.004 4.224a.24.24 0 0 0 .237.241h1.07c.13 0 .236-.108.236-.241v-4.543c0-.31-.034-.442-.08-.577a1.601 1.601 0 0 0-1.51-1.09h-.015a1.58 1.58 0 0 0-1.152.5c-.291-.308-.7-.5-1.153-.5zM.232 9.4A.234.234 0 0 0 0 9.636v5.924c0 .132.096.238.216.241h1.09c.13 0 .237-.107.237-.24l.004-1.658H2.57c.857 0 1.453-.605 1.453-1.481v-1.538c0-.877-.596-1.484-1.453-1.484H.232zm9.032 0a.239.239 0 0 0-.237.241v2.47c0 .94.657 1.608 1.579 1.608h.675s.016 0 .037.004a.253.253 0 0 1 .222.253c0 .13-.096.235-.219.251l-.018.004-.303.006H9.739a.239.239 0 0 0-.236.24v1.09a.24.24 0 0 0 .236.242h1.75c.92 0 1.577-.669 1.577-1.608v-4.56a.239.239 0 0 0-.236-.24h-1.07a.239.239 0 0 0-.236.24c-.005.787 0 1.525 0 2.255a.253.253 0 0 1-.25.25h-.449a.253.253 0 0 1-.25-.255c.005-.754-.005-1.5-.005-2.25a.239.239 0 0 0-.236-.24zm-4.004.006a.232.232 0 0 0-.238.226v1.023c0 .132.113.24.252.24h1.413c.112.017.2.1.213.23v.14c-.013.124-.1.214-.207.224h-.7c-.93 0-1.594.63-1.594 1.515v1.269c0 .88.57 1.506 1.495 1.506h1.94c.348 0 .63-.27.63-.6v-4.136c0-1.004-.508-1.637-1.72-1.637zm-3.713 1.572h.678c.139 0 .25.115.25.256v.836a.253.253 0 0 1-.25.256h-.1c-.192.002-.386 0-.578 0zm4.67 1.977h.445c.139 0 .252.108.252.24v.932a.23.23 0 0 1-.014.076.25.25 0 0 1-.238.164h-.445a.247.247 0 0 1-.252-.24v-.933c0-.132.113-.239.252-.239Z" />
    </svg>
  );
}

// Known, well-documented brand colors, used for a text badge since no verified logo
// artwork is available for these three (unlike the SVG marks above). CRED's identity is a
// near-universally recognized plain black/white wordmark; Amazon's navy+orange pairing is
// equally standard across all Amazon products including Amazon Pay. BHIM's official color
// isn't reliably documented anywhere checkable, so it stays neutral rather than guessing.
function TextBadge({ children, bg, fg }: { children: ReactNode; bg: string; fg: string }) {
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

const UPI_APPS: {
  key: string;
  label: string;
  buildUri: (params: string) => string;
  icon: ReactNode;
  // True when `icon` already renders the app name as real text (the TextBadge cases) —
  // showing the plain label too would just duplicate it. False/undefined means the icon is
  // a small brand mark alone (rendered aria-hidden), so the visible label carries the name.
  iconIsBadge?: boolean;
  wide?: boolean;
}[] = [
  { key: "gpay", label: "Google Pay", buildUri: (p) => `tez://upi/pay?${p}`, icon: <GooglePayIcon /> },
  { key: "phonepe", label: "PhonePe", buildUri: (p) => `phonepe://pay?${p}`, icon: <PhonePeIcon /> },
  { key: "paytm", label: "Paytm", buildUri: (p) => `paytmmp://pay?${p}`, icon: <PaytmIcon /> },
  {
    key: "amazonpay",
    label: "Amazon Pay",
    buildUri: (p) => `amazonpay://pay?${p}`,
    icon: (
      <TextBadge bg="#232F3E" fg="#FF9900">
        amazon pay
      </TextBadge>
    ),
    iconIsBadge: true,
  },
  {
    key: "cred",
    label: "CRED",
    buildUri: (p) => `credpay://upi/pay?${p}`,
    icon: (
      <TextBadge bg="#000000" fg="#FFFFFF">
        CRED
      </TextBadge>
    ),
    iconIsBadge: true,
  },
  {
    key: "bhim",
    label: "BHIM",
    buildUri: (p) => `bhim://pay?${p}`,
    icon: (
      <TextBadge bg="#374151" fg="#FFFFFF">
        BHIM
      </TextBadge>
    ),
    iconIsBadge: true,
  },
  // Not a specific app — invokes Android's own "open with" chooser via an explicit Intent
  // URL rather than a bare `upi://` href. A bare custom-scheme link like `upi://pay?...`
  // gets silently handed to whichever app the phone has set as its default UPI handler —
  // on plenty of devices that's WhatsApp Pay, not the banking app or wallet the payer
  // actually wanted. The `intent://` form asks Android to resolve the scheme itself
  // (action=android.intent.action.VIEW, no package= pin), which is the standard way UPI
  // payment gateways trigger the picker instead of a silent single-app launch.
  {
    key: "other",
    label: "Other UPI or banking app",
    buildUri: (p) => `intent://pay?${p}#Intent;scheme=upi;action=android.intent.action.VIEW;end`,
    icon: null,
    wide: true,
  },
];

/**
 * "Pay by UPI" block for the public payment pages (/pay/[id], /share/[token]): a QR code
 * plus one tile per major UPI app, so the payer picks where the payment opens instead of
 * clicking a bare `upi://pay` link and hoping the OS asks (some devices just launch
 * whichever app is set as the default handler — often not the one the payer wanted; see
 * the "other" entry above for the mitigation).
 *
 * Note: even the `intent://` link for "Other UPI or banking app" can't override a UPI
 * handler the payer's phone has been set to always launch automatically (Settings > Apps >
 * [App] > Open by default, on Android) — that's a device-level default outside what any
 * webpage can control. The QR code is the one option that's genuinely app-agnostic: it
 * works with literally any UPI app that can scan a code, sidestepping deep-link handoff
 * entirely.
 */
export async function UpiPaySection({
  upiId,
  payeeName,
  amount,
  currency,
  invoiceNumber,
}: {
  upiId: string;
  payeeName: string;
  amount: number;
  currency: CurrencyCode;
  invoiceNumber: string;
}) {
  const params = new URLSearchParams();
  params.set("pa", upiId);
  params.set("pn", payeeName || "Payee");
  params.set("tn", `Invoice ${invoiceNumber}`);
  if (currency === "INR" && amount > 0) {
    params.set("am", amount.toFixed(2));
    params.set("cu", "INR");
  }
  const paramStr = params.toString();
  const qrDataUrl = await QRCode.toDataURL(`upi://pay?${paramStr}`, { margin: 1, width: 220 }).catch(() => null);

  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border px-5 py-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Pay by UPI</p>
      {qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URI, not an optimizable remote image
        <img src={qrDataUrl} alt="UPI QR code" width={180} height={180} className="rounded-xl" />
      )}
      <div className="grid w-full grid-cols-2 gap-2">
        {UPI_APPS.map((app) => (
          <a
            key={app.key}
            href={app.buildUri(paramStr)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-bold text-foreground hover:border-accent ${app.wide ? "col-span-2" : ""}`}
          >
            {app.icon}
            {!app.iconIsBadge && <span className="truncate">{app.label}</span>}
          </a>
        ))}
      </div>
      <p className="text-[11px] text-muted">
        Tap your UPI app above, or scan the QR code with any UPI app. If a button opens the wrong app, that phone has
        it set as its default UPI handler — scanning the QR always works regardless.
      </p>
    </div>
  );
}
