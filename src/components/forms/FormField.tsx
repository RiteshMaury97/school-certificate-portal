"use client";

import { AlertCircle } from "lucide-react";
import { cloneElement, type ReactElement } from "react";

type ControlAttributes = {
  id?: string;
  className?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
};

type Props = {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: ReactElement<ControlAttributes>;
  className?: string;
};

export function FormField({
  id,
  label,
  required = false,
  helperText,
  error,
  children,
  className,
}: Props) {
  const helperId = helperText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;
  const input = cloneElement(children, {
    id,
    required,
    "aria-required": required,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy,
    className: [
      children.props.className,
      error ? "border-2 border-[var(--danger)]" : "",
    ].filter(Boolean).join(" "),
  });

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[var(--text)]">
        {label}{required && <span aria-hidden="true"> *</span>}
      </label>
      {helperText && <p id={helperId} className="mb-1 text-xs text-[var(--text-muted)]">{helperText}</p>}
      {input}
      {error && (
        <p id={errorId} role="alert" className="mt-1 flex items-start gap-1.5 text-sm font-medium text-[var(--danger)]">
          <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
