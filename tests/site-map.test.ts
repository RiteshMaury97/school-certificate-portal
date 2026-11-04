import { readdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import { NextRequest } from "next/server";
import { SaxesParser } from "saxes";
import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import { config as proxyConfig, proxy } from "../src/proxy";
import { NO_INDEX_ROUTE_PATHS, ROBOTS_DISALLOW_PATHS, SITE_MAP } from "../src/shared/site-map";

import type { SiteMapPage } from "../src/shared/site-map";

const configuredOrigin = "https://configured-site.example";
type SitemapEntry = ReturnType<typeof sitemap>[number];

function useConfiguredOrigin() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SITE_URL", configuredOrigin);
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("ADDITIONAL_ALLOWED_ORIGINS", "");
}

function serializeSitemap(entries: readonly SitemapEntry[]): string {
  const urls = entries.map((entry) => {
    const lastModified =
      entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified;
    if (!lastModified) throw new Error(`Missing lastModified for ${entry.url}.`);
    return `<url><loc>${entry.url}</loc><lastmod>${lastModified}</lastmod></url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("");
}

function parseSitemapUrls(xml: string): string[] {
  const parser = new SaxesParser();
  const urls: string[] = [];
  let inLocation = false;
  parser.on("opentag", (tag) => {
    if (tag.name === "loc") inLocation = true;
  });
  parser.on("text", (text) => {
    if (inLocation) urls.push(text);
  });
  parser.on("closetag", (tag) => {
    if (tag.name === "loc") inLocation = false;
  });
  parser.write(xml).close();
  return urls;
}

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
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

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

  it("emits valid XML for the exact public URL set on the configured origin", () => {
    useConfiguredOrigin();
    const xmlPages: readonly SiteMapPage[] = SITE_MAP.filter(
      (page) => page.indexable && page.inXmlSitemap,
    );
    const xmlEntries = sitemap();
    expect(sitemap()).toEqual(xmlEntries);
    const expectedUrls = xmlPages.map((page) => `${configuredOrigin}${page.path}`);
    expect(xmlEntries.map((entry) => entry.url)).toEqual(expectedUrls);
    for (const entry of xmlEntries) {
      const url = new URL(entry.url);
      expect(url.origin).toBe(configuredOrigin);
      expect(url.pathname).not.toMatch(/^\/(admin|api)(\/|$)/);
      expect(NO_INDEX_ROUTE_PATHS).not.toContain(url.pathname);
      expect(entry.lastModified).toBeTruthy();
    }
    expect(xmlEntries.map((entry) => [entry.priority, entry.changeFrequency])).toEqual(
      xmlPages.map((page) => [page.priority, page.changeFrequency]),
    );
    expect(Object.fromEntries(xmlPages.map((page) => [page.path, page.priority]))).toEqual({
      "/": 1,
      "/certificates": 0.8,
      "/verify": 0.8,
      "/faq": 0.6,
      "/contact": 0.6,
      "/report-wrong-record": 0.5,
      "/data-rights": 0.5,
      "/terms": 0.5,
      "/privacy": 0.5,
      "/sitemap": 0.4,
    });
    const buildLastModified = xmlEntries[0]?.lastModified;
    expect(buildLastModified).toBeTruthy();
    expect(xmlEntries.map((entry) => entry.lastModified)).toEqual(
      xmlPages.map((page) => page.lastModified ?? buildLastModified),
    );
    for (const path of ["/data-rights", "/terms", "/privacy"]) {
      expect(xmlEntries.find((entry) => new URL(entry.url).pathname === path)?.lastModified).toBe(
        "2026-10-01",
      );
    }

    expect(parseSitemapUrls(serializeSitemap(xmlEntries))).toEqual(expectedUrls);
  });

  it("derives robots.txt directives and absolute sitemap URL from the registry", () => {
    useConfiguredOrigin();
    const robotsMetadata = robots();
    const rules = Array.isArray(robotsMetadata.rules)
      ? robotsMetadata.rules[0]
      : robotsMetadata.rules;
    expect(rules?.allow).toEqual(
      SITE_MAP.filter((page) => page.indexable).map((page) => page.path),
    );
    expect(rules?.disallow).toEqual([...ROBOTS_DISALLOW_PATHS]);

    const sitemapUrl = Array.isArray(robotsMetadata.sitemap)
      ? robotsMetadata.sitemap[0]
      : robotsMetadata.sitemap;
    if (!sitemapUrl) throw new Error("Robots metadata must contain a sitemap URL.");
    expect(sitemapUrl).toBe(`${configuredOrigin}/sitemap.xml`);
    expect(new URL(sitemapUrl).origin).toBe(configuredOrigin);
  });

  it("runs robots.txt and sitemap.xml through proxy headers without maintenance blocking", async () => {
    useConfiguredOrigin();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected fetch"));

    for (const path of ["/robots.txt", "/sitemap.xml"]) {
      const response = await proxy(new NextRequest(`${configuredOrigin}${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(proxyConfig.matcher[0]).not.toContain("robots.txt");
  });
});
