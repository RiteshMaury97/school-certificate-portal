import type { ReactNode } from "react";
export default function Skeleton({ children }: { children?: ReactNode }) {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto min-h-[55dvh] w-full max-w-6xl px-4 py-8 sm:px-8"
    >
      <div className="animate-pulse space-y-5">
        <div className="h-8 w-2/5 rounded-lg bg-slate-200" />
        <div className="h-4 w-3/5 rounded bg-slate-100" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      </div>
      {children}
    </main>
  );
}
