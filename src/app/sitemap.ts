import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://invoice-generator.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/invoice/new", "/templates", "/login", "/signup"];
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
  }));
}
