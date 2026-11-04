import { absoluteUrl } from "@/server/site-origin";
import { ROBOTS_DISALLOW_PATHS, SITE_MAP, XML_SITEMAP_PATH } from "@/shared/site-map";

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: SITE_MAP.filter((page) => page.indexable).map((page) => page.path),
        disallow: [...ROBOTS_DISALLOW_PATHS],
      },
    ],
    sitemap: absoluteUrl(XML_SITEMAP_PATH),
  };
}
