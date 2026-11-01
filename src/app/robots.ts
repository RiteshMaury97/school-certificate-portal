import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/terms", "/privacy", "/verify"],
        disallow: [
          "/admin",
          "/admin/",
          "/api",
          "/api/",
          "/maintenance",
          "/certificates/print",
          "/certificates/results",
        ],
      },
    ],
    sitemap: `${(
      [process.env.SITE_URL, process.env.APP_ORIGIN].find(Boolean) ?? "https://example.org"
    ).replace(/\/$/, "")}/sitemap.xml`,
  };
}
