"use client";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorState({
  title = "Unable to load this information",
  description = "A connection or service error occurred. Please try again.",
  onRetry,
  retryLabel = "Retry",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="flex min-w-0 flex-col items-center gap-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--surface)] px-5 py-7 text-center text-[var(--text)]"
    >
      <AlertCircle aria-hidden="true" size={22} className="text-[var(--danger)]" />
      <h3 className="font-semibold">{title}</h3>
      <p className="max-w-lg text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--surface-2)]"
        >
          <RefreshCw size={16} aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </section>
  );
}
