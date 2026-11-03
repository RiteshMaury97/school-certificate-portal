import { ArrowDown, ArrowUp, BookOpen, CircleHelp, Eye, Languages, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { FaqItem } from "../../types/admin-state.types";

type FaqsTabProps = {
  faqs: FaqItem[];
  setFaqs: Dispatch<SetStateAction<FaqItem[]>>;
  saveFaqs: () => Promise<void>;
  busy: boolean;
};

export default function FaqsTab({ faqs, setFaqs, saveFaqs, busy }: FaqsTabProps) {
  const [search, setSearch] = useState("");
  const visibleFaqs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return faqs
      .map((faq, index) => ({ faq, index }))
      .filter(({ faq }) => `${faq.questionEn} ${faq.answerEn}`.toLowerCase().includes(query));
  }, [faqs, search]);

  function moveFaq(index: number, direction: -1 | 1) {
    setFaqs((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const item = next[index];
      const targetItem = next[target];
      if (!item || !targetItem) return current;
      next[index] = targetItem;
      next[target] = item;
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 text-[var(--text)]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Content / Public portal</p>
          <h2 className="mt-1 text-2xl font-bold">Frequently asked questions</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Manage the answers visitors see on your public school website.</p>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--success)]">● Published content</span>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="FAQ summary">
        {[
          { label: "FAQ entries", value: String(faqs.length).padStart(2, "0"), note: "Public questions", Icon: CircleHelp },
          { label: "English entries", value: String(faqs.length).padStart(2, "0"), note: "Ready for visitors", Icon: BookOpen },
          { label: "Languages", value: "01", note: "English source content", Icon: Languages },
          { label: "Translation", value: "On", note: "Visitors can use language control", Icon: Languages },
        ].map(({ label, value, note, Icon }) => (
          <article key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--primary)]"><Icon size={17} /></span>
              <div><p className="text-xs font-semibold text-[var(--text-muted)]">{label}</p><strong className="text-xl">{value}</strong></div>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">{note}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--divider)] p-4">
          <div><h3 className="font-bold">FAQ library</h3><p className="mt-0.5 text-xs text-[var(--text-muted)]">Edit, organize, and publish clear answers for families.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input id="faq-search" aria-label="Search FAQs" value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder="Search questions…" className="min-h-10 w-52 rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm" />
            </div>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold"><Languages size={14} /> English</span>
            <button type="button" onClick={() => { setFaqs((current) => [...current, { questionEn: "", answerEn: "" }]); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]"><Plus size={16} /> Add FAQ</button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-xs text-[var(--text-muted)]">* required</p>
          {visibleFaqs.map(({ faq, index }) => (
            <article key={`${String(index)}-${faq.questionEn}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">FAQ {String(index + 1).padStart(2, "0")}</span><span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-semibold text-[var(--success)]">English</span></div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { moveFaq(index, -1); }} disabled={index === 0} aria-label={`Move FAQ ${String(index + 1)} up`} className="grid h-8 w-8 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => { moveFaq(index, 1); }} disabled={index === faqs.length - 1} aria-label={`Move FAQ ${String(index + 1)} down`} className="grid h-8 w-8 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => { setFaqs((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} className="inline-flex min-h-8 items-center gap-1 rounded px-2 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--surface-2)]"><Trash2 size={13} /> Remove</button>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.7fr)]">
                <div><label htmlFor={`faq-question-${String(index)}`} className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Question / English *
                  <input id={`faq-question-${String(index)}`} aria-label="Question in English" translate="no" required aria-required="true" minLength={3} maxLength={180} value={faq.questionEn} onChange={(event) => { setFaqs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, questionEn: event.target.value } : item)); }} placeholder="Enter a frequently asked question" className="mt-1.5 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-normal normal-case tracking-normal text-[var(--text)]" />
                </label></div>
                <div><label htmlFor={`faq-answer-${String(index)}`} className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Answer / English *
                  <textarea id={`faq-answer-${String(index)}`} aria-label="Answer in English" translate="no" required aria-required="true" minLength={5} maxLength={1500} rows={2} value={faq.answerEn} onChange={(event) => { setFaqs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, answerEn: event.target.value } : item)); }} placeholder="Write a helpful answer for families" className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--text)]" />
                  <span className="mt-1 block text-right text-[10px] font-normal normal-case tracking-normal">{String(faq.answerEn.length)} / 1800 characters</span>
                </label></div>
              </div>
              <details className="mt-3 rounded-lg border border-[var(--border)] p-3">
                <summary className="cursor-pointer text-xs font-semibold text-[var(--text-muted)]">Optional translations</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(["hi", "bn", "mr", "gu", "pa", "ta", "te", "ur"] as const).map((locale) => (
                    <div key={locale} className="rounded-lg bg-[var(--surface-2)] p-3">
                      <p className="mb-2 text-[10px] font-bold uppercase text-[var(--text-muted)]">{locale}</p>
                      <input aria-label={`${locale} FAQ question`} value={faq.question_i18n?.[locale] ?? ""} onChange={(event) => setFaqs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, question_i18n: { ...item.question_i18n, [locale]: event.target.value } } : item))} className="mb-2 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" required aria-required="true" />
                      <textarea aria-label={`${locale} FAQ answer`} rows={2} value={faq.answer_i18n?.[locale] ?? ""} onChange={(event) => setFaqs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, answer_i18n: { ...item.answer_i18n, [locale]: event.target.value } } : item))} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" required aria-required="true" />
                    </div>
                  ))}
                </div>
              </details>
            </article>
          ))}
          {visibleFaqs.length === 0 && <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center"><p className="font-semibold">{faqs.length ? "No FAQs match your search" : "Your FAQ library is empty"}</p><p className="mt-1 text-sm text-[var(--text-muted)]">Add a question and answer to help visitors find information.</p></div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--divider)] p-4">
          <button type="button" onClick={() => { setFaqs((current) => [...current, { questionEn: "", answerEn: "" }]); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-2)]"><Plus size={15} /> Add another FAQ</button>
          <div className="flex flex-wrap gap-2">
            <Link href="/faq" target="_blank" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-2)]"><Eye size={15} /> Preview public page</Link>
            <button type="button" onClick={() => { void saveFaqs(); }} disabled={busy} aria-busy={busy} className="min-h-10 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60">{busy ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </section>

      <aside className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--primary)]"><Languages size={17} /></span><div><h3 className="text-sm font-bold">Publication & translation</h3><p className="mt-1 max-w-2xl text-xs text-[var(--text-muted)]">FAQ content is saved with your public site settings and shown on the public FAQ page. Visitors can request machine translation using the site language control.</p><span className="mt-3 inline-flex rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--success)]">Public page enabled</span></div></div>
        <Link href="/faq" target="_blank" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold"><Eye size={14} /> View public FAQs</Link>
      </aside>
    </div>
  );
}
