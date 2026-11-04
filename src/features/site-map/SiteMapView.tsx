"use client";

import Link from "next/link";

import SiteShell from "@/components/layout/SiteShell";
import { useT } from "@/i18n/locale-provider";
import { SITE_MAP, SITE_MAP_GROUPS } from "@/shared/site-map";

const groupTranslationKeys = {
  School: "siteMap.groups.school",
  Certificates: "siteMap.groups.certificates",
  "Help and support": "siteMap.groups.helpAndSupport",
  "Legal and privacy": "siteMap.groups.legalAndPrivacy",
} as const;

export default function SiteMapView() {
  const t = useT();
  const pages = SITE_MAP.filter((page) => page.inHtmlSitemap);

  return (
    <SiteShell>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("siteMap.title")}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
          {t("siteMap.intro")}
        </p>
      </header>
      <div className="grid gap-8 md:grid-cols-2">
        {SITE_MAP_GROUPS.map((group) => {
          const groupPages = pages.filter((page) => page.group === group);
          if (groupPages.length === 0) return null;

          return (
            <section key={group} aria-labelledby={`sitemap-${group}`}>
              <h2 id={`sitemap-${group}`} className="text-xl font-semibold">
                {t(groupTranslationKeys[group])}
              </h2>
              <ul className="mt-4 space-y-4">
                {groupPages.map((page) => (
                  <li key={page.path}>
                    <Link
                      className="font-semibold text-[var(--primary)] hover:underline"
                      href={page.path}
                    >
                      {t(page.labelKey)}
                    </Link>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      {t(page.descriptionKey)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </SiteShell>
  );
}
