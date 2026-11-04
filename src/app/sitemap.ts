import { absoluteUrl } from "@/server/site-origin";
import { SITE_MAP } from "@/shared/site-map";

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_MAP.filter((page) => page.indexable && page.inXmlSitemap).map((page) => ({
    url: absoluteUrl(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
