"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode };
export default function IconButton({ label, children, className = "", ...props }: Props) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      aria-label={label}
      title={label}
      data-tooltip={label}
      className={`group relative inline-grid h-11 w-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${className}`}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[70] hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--text)] px-2 py-1 text-xs font-medium text-[var(--surface)] shadow-lg group-hover:block group-focus-visible:block"
      >
        {label}
      </span>
    </button>
  );
}
