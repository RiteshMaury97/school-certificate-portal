import EmptyState from "@/src/components/EmptyState";

import type { ReactNode } from "react";

export default function SummarySection({ children }: { children?: ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">{children ?? <EmptyState title="No data found" />}</section>;
}
