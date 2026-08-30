import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sora, DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://invoice-generator.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Free Online Invoice Generator | Create Professional Invoices",
    template: "%s | Invoice Generator",
  },
  description:
    "Create professional invoices online in seconds. Customize invoices, calculate taxes, download PDFs, and print invoices easily.",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Invoice Generator",
    title: "Free Online Invoice Generator | Create Professional Invoices",
    description:
      "Create, customize, print, and download professional invoices online — no complicated software required.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Online Invoice Generator | Create Professional Invoices",
    description:
      "Create, customize, print, and download professional invoices online — no complicated software required.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overflow-x-hidden bg-background text-foreground">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
