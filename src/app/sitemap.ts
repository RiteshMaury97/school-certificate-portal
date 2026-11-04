import { absoluteUrl } from "@/server/site-origin";
import { SITE_MAP } from "@/shared/site-map";

import type { SiteMapPage } from "@/shared/site-map";
import type { MetadataRoute } from "next";

const BUILD_LAST_MODIFIED = new Date().toISOString();

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: readonly SiteMapPage[] = SITE_MAP.filter(
    (page) => page.indexable && page.inXmlSitemap,
  );
  return pages.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: page.lastModified ?? BUILD_LAST_MODIFIED,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
