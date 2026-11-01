"use client";
import { useId } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

/** Six-digit one-time code input used for email-code verification. */
export default function CodeField({ label, value, onChange, autoFocus }: Props) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <input
        id={id}
        translate="no"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => {
          onChange(event.target.value.replace(/\D/g, ""));
        }}
        className="mt-2 min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-xl tracking-[.4em] text-[var(--text)]"
      />
    </label>
  );
}
