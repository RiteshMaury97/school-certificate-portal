import type { Dispatch, SetStateAction } from "react";

type DuplicateHashWarningProps = {
  warning: string;
  acknowledged: boolean;
  reason: string;
  setAcknowledged: Dispatch<SetStateAction<boolean>>;
  setReason: Dispatch<SetStateAction<string>>;
  className: string;
};

export default function DuplicateHashWarning({
  warning,
  acknowledged,
  reason,
  setAcknowledged,
  setReason,
  className,
}: DuplicateHashWarningProps) {
  if (!warning) return null;
  return (
    <div className={className}>
      <p className="font-bold text-[var(--text)]">{warning}</p>
      <label htmlFor="duplicate-hash-acknowledged" className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        <input
          id="duplicate-hash-acknowledged"
          aria-label="Confirm duplicate is intentional"
          translate="no"
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => { setAcknowledged(e.target.checked); }}
          className="h-5 w-5"
        />{" "}
        I confirm this is intentional
      </label>
      <label htmlFor="duplicate-hash-reason" className="mt-2 block text-sm font-semibold text-[var(--text)]">
        Reason
        <textarea
          id="duplicate-hash-reason"
          aria-label="Reason for duplicate warning acknowledgement"
          translate="no"
          value={reason}
          onChange={(e) => { setReason(e.target.value); }}
          minLength={10}
          maxLength={500}
          className="mt-1 block w-full rounded border bg-[var(--surface)] p-2"
        />
      </label>
    </div>
  );
}
