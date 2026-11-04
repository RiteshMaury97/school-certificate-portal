"use client";

import SiteShell from "@/components/layout/SiteShell";
import { useT } from "@/i18n/locale-provider";

import type { ReactNode } from "react";

export type LegalSection = { id: string; title: string; content: ReactNode };

type Props = {
  title: string;
  subtitle: string;
  version: string;
  updated: string;
  sections: LegalSection[];
  children?: ReactNode;
  extraToc?: { id: string; title: string };
};

function LegalHeader({
  title,
  subtitle,
  version,
  updated,
}: Pick<Props, "title" | "subtitle" | "version" | "updated">) {
  const t = useT();
  const localizedTitle = title === "Privacy Policy" ? t("legal.privacy") : title === "Terms & Conditions" ? t("legal.terms") : title;
  return (
    <header className="mb-8 rounded-3xl border border-[var(--divider)] bg-[var(--surface)] px-6 py-8 shadow-sm sm:px-10 sm:py-10">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--text-muted)]">
        &quot;Satyam International School · Legal information&quot;
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
        {localizedTitle}
      </h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--text-muted)]">{subtitle}</p>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5">
          &quot;Version&quot; {version}
        </span>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5">
          Last updated: {updated}
        </span>
        <button
          type="button"
          onClick={() => {
            window.print();
          }}
          className="ml-auto min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        >
          Print this page
        </button>
      </div>
    </header>
  );
}

function CompactTableOfContents({ sections, extraToc }: Pick<Props, "sections" | "extraToc">) {
  return (
    <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:hidden">
      <summary className="cursor-pointer font-bold text-[var(--text)]">On this page</summary>
      <nav aria-label="On this page" className="pt-3">
        <ol className="space-y-1.5">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="block rounded-lg px-2 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              >
                {String(index + 1).padStart(2, "0")} {section.title}
              </a>
            </li>
          ))}
          {extraToc && (
            <li>
              <a
                href={`#${extraToc.id}`}
                className="block rounded-lg px-2 py-1.5 text-sm text-[var(--text-muted)]"
              >
                {extraToc.title}
              </a>
            </li>
          )}
        </ol>
      </nav>
    </details>
  );
}

function FullTableOfContents({ sections, extraToc }: Pick<Props, "sections" | "extraToc">) {
  return (
    <nav
      aria-label="On this page"
      className="hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm lg:block"
    >
      <h2 className="text-sm font-bold text-[var(--text)]">&quot;On this page&quot;</h2>
      <ol className="mt-3 space-y-1.5">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="flex gap-2 rounded-lg px-2 py-1.5 text-sm leading-5 text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[var(--text-muted)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.title}
            </a>
          </li>
        ))}
        {extraToc && (
          <li>
            <a
              href={`#${extraToc.id}`}
              className="flex gap-2 rounded-lg px-2 py-1.5 text-sm leading-5 text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-[var(--text-muted)]">
                {String(sections.length + 1).padStart(2, "0")}
              </span>
              {extraToc.title}
            </a>
          </li>
        )}
      </ol>
    </nav>
  );
}

function LegalTableOfContents({ sections, extraToc }: Pick<Props, "sections" | "extraToc">) {
  return (
    <aside className="lg:sticky lg:top-6">
      <CompactTableOfContents
        sections={sections}
        {...(extraToc !== undefined ? { extraToc } : {})}
      />
      <FullTableOfContents sections={sections} {...(extraToc !== undefined ? { extraToc } : {})} />
    </aside>
  );
}

function LegalSections({ sections }: Pick<Props, "sections">) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section id={section.id} key={section.id} className="scroll-mt-8">
          <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">{section.title}</h2>
          <div className="mt-3 space-y-3 text-sm leading-7 text-[var(--text)]">{section.content}</div>
        </section>
      ))}
    </div>
  );
}

export default function LegalPageLayout({
  title,
  subtitle,
  version,
  updated,
  sections,
  children,
  extraToc,
}: Props) {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl">
        <LegalHeader title={title} subtitle={subtitle} version={version} updated={updated} />
        <div className="grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <LegalTableOfContents
            sections={sections}
            {...(extraToc !== undefined ? { extraToc } : {})}
          />
          <article className="min-w-0 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] px-5 py-7 shadow-sm sm:px-9 sm:py-10">
            <LegalSections sections={sections} />
            {children}
          </article>
        </div>
      </div>
    </SiteShell>
  );
}
