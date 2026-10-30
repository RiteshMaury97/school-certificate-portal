"use client";
import { useEffect, useMemo, useState } from "react";

import EmptyState from "@/src/components/EmptyState";
import ErrorState from "@/src/components/feedback/ErrorState";
import PublicServiceTabs from "@/src/components/PublicServiceTabs";
import SiteShell from "@/src/components/SiteShell";
type Faq = {
  questionEn: string;
  answerEn: string;
};

export default function FaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/public/site-settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load FAQ");
        return response.json();
      })
      .then((data) => {
        if (active) {
          setFaqs(
            Array.isArray(data.settings?.faqs)
              ? (data.settings.faqs as Faq[]).filter(
                  (item) => item.questionEn?.trim() && item.answerEn?.trim(),
                )
              : [],
          );
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
      faqs.filter((item) =>
        `${item.questionEn} ${item.answerEn}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [faqs, loading, query],
  );
  return (
    <SiteShell>
      <div className="mx-auto max-w-4xl">
        <PublicServiceTabs />
        <h1 className="text-3xl font-bold dark:text-white">{"Frequently Asked Questions"}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          "Answers about finding, verifying and requesting support for school certificates."
        </p>
        <label className="mt-6 block text-sm font-semibold text-[var(--text)]">
          Search questions
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); }}
            placeholder="Type a question or keyword"
            className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 font-normal"
          />
        </label>
        {loading ? (
          <div className="mt-6 space-y-3" aria-label="Loading FAQs">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-xl bg-[var(--surface-2)]" />
            ))}
          </div>
        ) : loadError ? (
          <div className="mt-6">
            <ErrorState onRetry={() => { setRetry((value) => value + 1); }} />
          </div>
        ) : (
          <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-5 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
            {visibleFaqs.map((item, index) => (
              <details key={`${item.questionEn}-${index}`} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-slate-100">
                  <span>{item.questionEn}</span>
                  <span aria-hidden="true" className="text-xl text-slate-500 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {item.answerEn}
                </p>
              </details>
            ))}
            {visibleFaqs.length === 0 && (
              <div className="py-4">
                <EmptyState
                  title="No data found"
                  description={
                    faqs.length
                      ? "No questions match your search."
                      : "Frequently asked questions have not been published yet."
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
