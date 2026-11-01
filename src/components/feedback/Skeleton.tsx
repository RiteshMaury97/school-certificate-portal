import type { ReactNode } from "react";

/** Content-shaped shimmer placeholder used as the route-level loading state. */
export default function Skeleton({ children }: { children?: ReactNode }) {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto min-h-[55dvh] w-full max-w-6xl px-4 py-8 sm:px-8"
    >
      <span className="sr-only">Loading…</span>
      <div className="space-y-5">
        <div className="skeleton h-8 w-2/5" />
        <div className="skeleton h-4 w-3/5" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="skeleton h-40 border border-[var(--divider)]" />
          ))}
        </div>
      </div>
      {children}
    </main>
  );
}
