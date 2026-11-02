export const inputClass =
  "mt-1.5 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15";
export const warning = "mt-1 text-[11px] leading-4 text-[var(--text-muted)]";

import { DatePicker } from "@/components/ui/DatePicker";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
};
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength = 160,
}: FieldProps) {
  const id = `breach-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label htmlFor={id} className="block text-sm font-medium text-[var(--text)]">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {type === "datetime-local" ? (
        <DatePicker id={id} label={label} value={value} onChange={onChange} required={required} includeTime className="mt-1.5" />
      ) : (
        <input
          id={id}
          aria-label={label}
          className={inputClass}
          type={type}
          maxLength={type === "text" ? maxLength : undefined}
          value={value}
          required={required}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
      {type === "text" && (
        <p className={warning}>
          Do not enter names, phone numbers, email addresses or other personal details.
        </p>
      )}
    </label>
  );
}

type TextAreaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
};
export function TextArea({
  label,
  value,
  onChange,
  required = false,
  maxLength = 2000,
  minLength = 1,
}: TextAreaProps) {
  const id = `breach-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label htmlFor={id} className="block text-sm font-medium text-[var(--text)]">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <textarea
        id={id}
        aria-label={label}
        className={`${inputClass} min-h-24 resize-y`}
        value={value}
        required={required}
        maxLength={maxLength}
        minLength={required ? minLength : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p className={warning}>
        Do not enter names, phone numbers, email addresses or other personal details.
      </p>
    </label>
  );
}
