import type { FaqItem } from "../../types/admin-state.types";
import type { Dispatch, SetStateAction } from "react";

type FaqsTabProps = {
  faqs: FaqItem[];
  setFaqs: Dispatch<SetStateAction<FaqItem[]>>;
  saveFaqs: () => Promise<void>;
  busy: boolean;
};

export default function FaqsTab({ faqs, setFaqs, saveFaqs, busy }: FaqsTabProps) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Editable public FAQs</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Content is saved in siteSettings/main and displayed on the public FAQ page. Visitors can request machine translation using the public language control.
      </p>
      <div className="mt-5 space-y-5">
        {faqs.map((faq, index) => (
          <article key={index} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center justify-between">
              <b>FAQ {index + 1}</b>
              <button onClick={() => { setFaqs((v) => v.filter((_, i) => i !== index)); }} className="text-sm text-[var(--danger)]">Remove</button>
            </div>
            {([ ["questionEn", "Question (English)"], ["answerEn", "Answer (English)"] ] as const).map(([key, label]) => (
              <label key={key} className="text-sm font-semibold">
                {label}
                {key.startsWith("answer") ? (
                  <textarea translate="no" rows={4} value={faq[key]} onChange={(e) => { setFaqs((v) => v.map((x, i) => i === index ? { ...x, [key]: e.target.value } : x)); }} className="mt-1 w-full rounded border p-2" />
                ) : (
                  <input translate="no" value={faq[key]} onChange={(e) => { setFaqs((v) => v.map((x, i) => i === index ? { ...x, [key]: e.target.value } : x)); }} className="mt-1 w-full rounded border p-2" />
                )}
              </label>
            ))}
          </article>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => { setFaqs((v) => [...v, { questionEn: "", answerEn: "" }]); }} className="rounded border px-4 py-2 text-sm">Add FAQ</button>
        <button onClick={saveFaqs} disabled={busy} aria-busy={busy} className="rounded bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]">Save FAQs</button>
      </div>
    </section>
  );
}
