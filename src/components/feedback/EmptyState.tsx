"use client";
import { Inbox } from "lucide-react";

import type { ReactNode } from "react";

export type EmptyStateProps = {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({
  icon,
  title = "No data found",
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className={`flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-8 text-center text-[var(--text)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]"
      >
        {icon ?? <Inbox size={20} />}
      </span>
      <h3 className="font-semibold">{title}</h3>
      {description && (
        <p className="max-w-lg text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </section>
  );
}
