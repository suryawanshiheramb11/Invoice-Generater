import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://invoice-generator.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/invoice/new"],
        // Saved invoices are private records, not public content — everything else here
        // (dashboard, customers, settings, individual invoice URLs) requires auth anyway.
        // /pay/ and /share/ are the exception that matters most: they need no auth at all,
        // and they show an amount owed plus the sender's bank/UPI details to anyone with
        // the link. Crawling them would publish exactly what the unguessable id protects.
        // (Belt and braces — those pages also send robots: noindex in their own metadata,
        // which is what actually keeps an already-discovered URL out of an index.)
        disallow: [
          "/dashboard",
          "/customers",
          "/settings",
          "/invoice/",
          "/reset-password",
          "/pay/",
          "/share/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
