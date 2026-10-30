import type { ReactNode } from "react";
export default function ResultCard({
  title,
  details,
  actions,
}: {
  title: string;
  details: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-[var(--text)]">{title}</h2>
      <div className="mt-3 text-sm text-slate-600">{details}</div>
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}
