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
        disallow: ["/dashboard", "/customers", "/settings", "/invoice/", "/reset-password"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
