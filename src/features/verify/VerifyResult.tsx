import type { ReactNode } from "react";
export default function VerifyResult({ children }: { children: ReactNode }) {
  return (
    <section
      aria-live="polite"
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      {children}
    </section>
  );
}
