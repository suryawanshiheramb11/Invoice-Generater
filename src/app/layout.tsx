import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  variable: "--font-inter",
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overflow-x-hidden bg-background text-foreground">
        <ToastProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
