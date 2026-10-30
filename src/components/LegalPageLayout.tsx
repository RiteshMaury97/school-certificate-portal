import type { ReactNode } from "react";
import SiteShell from "@/src/components/SiteShell";

export type LegalSection = { id: string; title: string; content: ReactNode };
export default function LegalPageLayout({
  title,
  subtitle,
  version,
  updated,
  sections,
  children,
  extraToc,
}: {
  title: string;
  subtitle: string;
  version: string;
  updated: string;
  sections: LegalSection[];
  children?: ReactNode;
  extraToc?: { id: string; title: string };
}) {
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-slate-500">
            "Satyam International School · Legal information"
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{subtitle}</p>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">"Version" {version}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">Last updated {updated}</span>
            <button
              type="button"
              onClick={() => window.print()}
              className="ml-auto min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
            >
              Print this page
            </button>
          </div>
        </header>
        <div className="grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6">
            <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:hidden">
              <summary className="cursor-pointer font-bold text-[var(--text)]">
                On this page
              </summary>
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
            <nav
              aria-label="On this page"
              className="hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm lg:block"
            >
              <h2 className="text-sm font-bold text-slate-900">"On this page"</h2>
              <ol className="mt-3 space-y-1.5">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-2 rounded-lg px-2 py-1.5 text-sm leading-5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                    >
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">
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
                      className="flex gap-2 rounded-lg px-2 py-1.5 text-sm leading-5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                    >
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">
                        {String(sections.length + 1).padStart(2, "0")}
                      </span>
                      {extraToc.title}
                    </a>
                  </li>
                )}
              </ol>
            </nav>
          </aside>
          <article className="min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-9 sm:py-10">
            <div className="space-y-10">
              {sections.map((section) => (
                <section id={section.id} key={section.id} className="scroll-mt-8">
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">
                    {section.title}
                  </h2>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                    {section.content}
                  </div>
                </section>
              ))}
            </div>
            {children}
          </article>
        </div>
      </div>
    </SiteShell>
  );
}
