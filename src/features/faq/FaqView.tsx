"use client";
import { ArrowRight, BadgeCheck, FileCheck2, LockKeyhole, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import SiteShell from "@/components/layout/SiteShell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useLocale, useT } from "@/i18n/locale-provider";
type Faq = {
  questionEn: string;
  answerEn: string;
  question_i18n?: Record<string, string>;
  answer_i18n?: Record<string, string>;
};

function isFaq(value: unknown): value is Faq {
  if (typeof value !== "object" || value === null) return false;
  return (
    "questionEn" in value && typeof value.questionEn === "string" &&
    "answerEn" in value && typeof value.answerEn === "string"
  );
}

function readFaqs(value: unknown): Faq[] {
  if (typeof value !== "object" || value === null || !("settings" in value)) return [];
  const settings = value.settings;
  if (typeof settings !== "object" || settings === null || !("faqs" in settings)) return [];
  return Array.isArray(settings.faqs)
    ? settings.faqs.filter(isFaq).filter((item) => item.questionEn.trim() && item.answerEn.trim())
    : [];
}

const categories = [
  "All questions",
  "Finding a record",
  "Certificates",
  "Privacy & security",
  "Other support",
] as const;
type Category = (typeof categories)[number];

const quickLinks = [
  {
    icon: FileCheck2,
    title: "Find my certificate",
    description: "Search your student record",
    href: "/certificates",
  },
  {
    icon: BadgeCheck,
    title: "Request a correction",
    description: "Report a record issue",
    href: "/report-wrong-record",
  },
  {
    icon: ShieldCheck,
    title: "Certificate verification",
    description: "Check a document’s authenticity",
    href: "/verify",
  },
];

function categoryFor(item: Faq): Exclude<Category, "All questions"> {
  const text = `${item.questionEn} ${item.answerEn}`.toLowerCase();
  if (/privacy|safe|secure|data|consent|dpdp|personal information/.test(text))
    return "Privacy & security";
  if (/certificate|verify|verification|hard copy|correction|wrong details/.test(text))
    return "Certificates";
  if (/find|search|name|session|record|admission|student/.test(text)) return "Finding a record";
  return "Other support";
}

export default function FaqPage() {
  const { locale } = useLocale();
  const t = useT();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All questions");
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void fetch("/api/public/site-settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load FAQ");
        const data: unknown = await response.json();
        return readFaqs(data);
      })
      .then((data) => {
        if (active) {
          setFaqs(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const visibleFaqs = useMemo(
    () =>
      faqs.filter(
        (item) =>
          `${item.questionEn} ${item.answerEn}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()) &&
          (category === "All questions" || categoryFor(item) === category),
      ),
    [faqs, query, category],
  );
  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">{t("nav.home")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/faq">Help centre</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("home.studentServices")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <header className="rounded-3xl bg-[var(--surface-2)] px-5 py-7 sm:px-8 sm:py-9">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--primary)]">
            Help centre / Student services
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {t("faq.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            Clear answers about finding, verifying and requesting support for school certificates.
          </p>
          <label
            htmlFor="faq-search"
            className="mt-5 block max-w-2xl text-xs font-semibold text-[var(--text)]"
          >
            Search the help centre
            <span className="relative mt-2 block">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                id="faq-search"
                aria-label="Search frequently asked questions"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Search by keyword or question..."
                className="min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-10 pr-3 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus)]"
              />
            </span>
          </label>
        </header>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="FAQ categories">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => {
                setCategory(item);
              }}
              className={`min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-medium transition ${category === item ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]" : "border-[var(--divider)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(250px,.8fr)]">
          <section
            aria-labelledby="faq-list-title"
            className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] pb-4">
              <h2 id="faq-list-title" className="text-sm font-bold text-[var(--text)]">
                Questions
              </h2>
              <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] font-semibold text-[var(--primary)]">
                {loading
                  ? "Loading"
                  : `${String(visibleFaqs.length)} ${visibleFaqs.length === 1 ? "answer" : "answers"}`}
              </span>
            </div>
            {loading ? (
              <div className="mt-4 space-y-3" aria-label="Loading FAQs" aria-live="polite">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                ))}
              </div>
            ) : loadError ? (
              <div className="mt-4">
                <ErrorState
                  onRetry={() => {
                    setLoading(true);
                    setRetry((value) => value + 1);
                  }}
                />
              </div>
            ) : visibleFaqs.length > 0 ? (
              <div className="divide-y divide-[var(--divider)]">
                {visibleFaqs.map((item, index) => (
                  <details
                    key={`${item.questionEn}-${String(index)}`}
                    className="group py-4 first:pt-5 last:pb-1"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]">
                      <span>{item.question_i18n?.[locale]?.length ? item.question_i18n[locale] : item.questionEn}</span>
                      <span
                        aria-hidden="true"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-base font-normal text-[var(--primary)] transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 max-w-3xl text-xs leading-6 text-[var(--text-muted)]">
                      {item.answer_i18n?.[locale]?.length ? item.answer_i18n[locale] : item.answerEn}
                    </p>
                  </details>
                ))}
              </div>
            ) : (
              <div className="py-5">
                <EmptyState
                  title="No matching questions"
                  description={
                    faqs.length
                      ? "Try another search term or choose a different topic."
                      : "Frequently asked questions have not been published yet."
                  }
                />
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <section className="rounded-2xl bg-[var(--primary)] p-5 text-[var(--on-primary)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--on-primary)_75%,transparent)]">
                Can’t find your answer?
              </p>
              <h2 className="mt-2 text-lg font-semibold">We’re here to help.</h2>
              <p className="mt-2 text-xs leading-5 text-[color-mix(in_srgb,var(--on-primary)_80%,transparent)]">
                Tell us what’s going on and our student support team will guide you through the next
                steps.
              </p>
              <Link
                href="/contact"
                className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)]"
              >
                Contact support <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </section>

            <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-sm font-bold text-[var(--text)]">Quick links</h2>
              <ul className="mt-3 space-y-3">
                {quickLinks.map(({ icon: Icon, title, description, href }) => (
                  <li key={title}>
                    <Link
                      href={href}
                      className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-[var(--surface-2)]"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-xs font-semibold text-[var(--text)]">
                          {title}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
                          {description}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface-2)] p-5">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
                <LockKeyhole size={14} aria-hidden="true" className="text-[var(--primary)]" /> Your
                information stays protected
              </h2>
              <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">
                We only use the details you provide to match school records. Your information is
                never used for advertising.
              </p>
              <Link
                href="/privacy"
                className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--primary)]"
              >
                Read our privacy policy <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </SiteShell>
  );
}
