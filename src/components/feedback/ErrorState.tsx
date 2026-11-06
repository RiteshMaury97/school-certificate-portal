"use client";

import { useEffect } from "react";

import { toast } from "@/components/ui/toast";

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
  useEffect(() => {
    toast.add({
      type: "error",
      title,
      description,
      ...(onRetry ? { actionProps: { children: retryLabel, onClick: onRetry } } : {}),
    });
  }, [description, onRetry, retryLabel, title]);
  return (
    <div role="alert" className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface)] p-4">
      <p className="font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
