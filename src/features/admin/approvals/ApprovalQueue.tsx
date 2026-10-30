import type { ReactNode } from "react";
import EmptyState from "@/src/components/EmptyState";

export default function SummarySection({ children }: { children?: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      {children ?? <EmptyState title="No data found" />}
    </section>
  );
}
