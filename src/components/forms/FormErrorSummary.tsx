"use client";

import { AlertCircle } from "lucide-react";

export function FormErrorSummary({ errors }: { errors: Record<string, string> }) {
  const messages = [...new Set(Object.values(errors))];
  return (
    <div aria-live="polite" aria-atomic="true">
      {messages.length > 0 && (
        <div role="alert" className="mb-4 rounded-lg border-2 border-[var(--danger)] bg-[var(--surface)] p-3 text-sm font-medium text-[var(--text)]">
          <p className="flex items-center gap-2 font-semibold"><AlertCircle size={17} aria-hidden="true" /> Check these fields:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {messages.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
