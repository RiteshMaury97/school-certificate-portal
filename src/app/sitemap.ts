import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (
    [process.env.SITE_URL, process.env.APP_ORIGIN].find(Boolean) ?? "https://example.org"
  ).replace(
    /\/$/,
    "",
  );
  return ["", "/terms", "/privacy", "/verify"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
