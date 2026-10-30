import type { ReactNode } from "react";
export default function Accordion({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="min-h-8 cursor-pointer font-semibold">{title}</summary>
      <div className="pt-3 text-sm leading-6 text-slate-600">{children}</div>
    </details>
  );
}
