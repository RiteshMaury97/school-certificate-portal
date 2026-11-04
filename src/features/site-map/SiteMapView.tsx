"use client";

import Link from "next/link";


import SiteShell from "@/components/layout/SiteShell";
import { useT } from "@/i18n/locale-provider";
import { SITE_MAP, SITE_MAP_GROUPS } from "@/shared/site-map";

import type { CSSProperties } from "react";

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
      <header className="sitemap-hero relative mb-8 flex items-center justify-between gap-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] px-6 py-7 sm:mb-10 sm:px-9 sm:py-9">
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("siteMap.title")}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            {t("siteMap.intro")}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="sitemap-hero-mark hidden h-20 w-20 shrink-0 place-items-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] shadow-sm sm:grid"
        >
          <svg viewBox="0 0 48 48" fill="none" className="h-10 w-10" aria-hidden="true">
            <path
              d="M8 12.5 19 8l10 4.5L40 8v27.5L29 40l-10-4.5L8 40V12.5Z"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path d="M19 8v27.5M29 12.5V40" stroke="currentColor" strokeWidth="2.5" />
            <path
              d="M13.5 19h.01M24 24h.01M34.5 19h.01"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div
          aria-hidden="true"
          className="sitemap-hero-glow pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[var(--primary)] opacity-[0.06] blur-3xl"
        />
      </header>

      <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
        {SITE_MAP_GROUPS.map((group, index) => {
          const groupPages = pages.filter((page) => page.group === group);
          if (groupPages.length === 0) return null;

          return (
            <section
              key={group}
              aria-labelledby={`sitemap-${group}`}
              className="sitemap-card group/card relative overflow-hidden rounded-2xl border border-[var(--border)] border-t-2 border-t-[var(--primary)] bg-[var(--surface)] p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-6"
            >
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)] text-sm font-bold text-[var(--primary)] ring-1 ring-[var(--border)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2
                  id={`sitemap-${group}`}
                  className="text-lg font-semibold tracking-tight sm:text-xl"
                >
                  {t(groupTranslationKeys[group])}
                </h2>
              </div>
              <ul className="space-y-2">
                {groupPages.map((page, pageIndex) => (
                  <li
                    key={page.path}
                    className="sitemap-entry"
                    style={{ "--entry-delay": `${String(150 + pageIndex * 65)}ms` } satisfies CSSProperties & { "--entry-delay": string }}
                  >
                    <Link
                      className="group/link flex items-start justify-between gap-4 rounded-xl border border-transparent px-3 py-3 no-underline transition duration-200 hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] focus:no-underline"
                      href={page.path}
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold text-[var(--primary)] no-underline">
                          {t(page.labelKey)}
                        </span>
                        <span className="mt-1 block max-w-prose text-sm leading-6 text-[var(--text-muted)] no-underline">
                          {t(page.descriptionKey)}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-lg leading-none text-[var(--text-muted)] transition-transform duration-200 group-hover/link:translate-x-1 group-hover/link:text-[var(--primary)]"
                      >
                        →
                      </span>
                    </Link>
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
