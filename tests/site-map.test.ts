import { readdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";
import {
  NO_INDEX_ROUTE_PATHS,
  ROBOTS_DISALLOW_PATHS,
  SITE_MAP,
  XML_SITEMAP_PATH,
} from "../src/shared/site-map";

async function findPageFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return findPageFiles(path);
      return entry.isFile() && entry.name === "page.tsx" ? [path] : [];
    }),
  );
  return files.flat();
}

function routePath(appRoot: string, pageFile: string): string | null {
  const segments = relative(appRoot, dirname(pageFile))
    .split(sep)
    .filter((segment) => segment && !/^\(.+\)$/.test(segment) && !segment.startsWith("@"));

  if (segments.includes("admin") || segments.includes("api")) return null;
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

describe("public page site map registry", () => {
  it("accounts for every public page route or explicitly noindexed route", async () => {
    const appRoot = join(process.cwd(), "src", "app");
    const routes = (await findPageFiles(appRoot))
      .map((pageFile) => routePath(appRoot, pageFile))
      .filter((path): path is string => path !== null);
    const registeredPaths = new Set<string>(SITE_MAP.map((page) => page.path));
    const noIndexPaths = new Set<string>(NO_INDEX_ROUTE_PATHS);

    for (const path of routes) {
      expect(
        registeredPaths.has(path) || noIndexPaths.has(path),
        `Add ${path} to the site map registry or explicit noindex list.`,
      ).toBe(true);
    }
  });

  it("keeps explicitly noindexed public routes out of both sitemaps", () => {
    for (const path of NO_INDEX_ROUTE_PATHS) {
      const page = SITE_MAP.find((entry) => entry.path === path);
      expect(page?.indexable ?? false, `${path} must not be indexable`).toBe(false);
      expect(page?.inXmlSitemap ?? false, `${path} must not be in the XML sitemap`).toBe(false);
      expect(page?.inHtmlSitemap ?? false, `${path} must not be in the HTML sitemap`).toBe(false);
    }
  });

  it("derives XML and robots metadata from the registry", () => {
    const xmlPages = SITE_MAP.filter((page) => page.indexable && page.inXmlSitemap);
    const xmlEntries = sitemap();
    expect(xmlEntries.map((entry) => new URL(entry.url).pathname)).toEqual(
      xmlPages.map((page) => page.path),
    );
    expect(xmlEntries.map((entry) => [entry.priority, entry.changeFrequency])).toEqual(
      xmlPages.map((page) => [page.priority, page.changeFrequency]),
    );

    const robotsMetadata = robots();
    const rules = Array.isArray(robotsMetadata.rules)
      ? robotsMetadata.rules[0]
      : robotsMetadata.rules;
    expect(rules?.allow).toEqual(SITE_MAP.filter((page) => page.indexable).map((page) => page.path));
    expect(rules?.disallow).toEqual([...ROBOTS_DISALLOW_PATHS]);

    const sitemapUrl = Array.isArray(robotsMetadata.sitemap)
      ? robotsMetadata.sitemap[0]
      : robotsMetadata.sitemap;
    expect(sitemapUrl ? new URL(sitemapUrl).pathname : undefined).toBe(XML_SITEMAP_PATH);
  });
});
