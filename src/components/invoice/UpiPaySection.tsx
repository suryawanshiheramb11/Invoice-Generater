import QRCode from "qrcode";
import { Smartphone } from "lucide-react";
import type { CurrencyCode } from "@/types/invoice";

// Per-app UPI deep-link schemes. `upi://pay` is the generic intent (Android shows a picker
// for it, but only among apps that didn't already grab a more specific scheme) — the
// named schemes below let the payer pick their app directly instead of trusting whatever
// the OS resolves a bare `upi://` link to.
const UPI_APPS: { key: string; label: string; buildUri: (params: string) => string }[] = [
  { key: "gpay", label: "Google Pay", buildUri: (p) => `tez://upi/pay?${p}` },
  { key: "phonepe", label: "PhonePe", buildUri: (p) => `phonepe://pay?${p}` },
  { key: "paytm", label: "Paytm", buildUri: (p) => `paytmmp://pay?${p}` },
  { key: "other", label: "Other UPI app", buildUri: (p) => `upi://pay?${p}` },
];

/**
 * "Pay by UPI" block for the public payment pages (/pay/[id], /share/[token]): a QR code
 * plus one button per major UPI app, so the payer picks where the payment opens instead of
 * clicking a bare `upi://pay` link and hoping the OS asks (some devices/browsers just
 * launch whichever app last claimed the scheme — often not the one the payer wanted).
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
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2.5 text-xs font-bold text-accent-foreground hover:bg-accent-hover"
          >
            <Smartphone className="h-3.5 w-3.5" /> {app.label}
          </a>
        ))}
      </div>
      <p className="text-[11px] text-muted">Tap your UPI app above to pay directly, or scan the QR code with any UPI app.</p>
    </div>
  );
}
