import { useEffect, useRef, useState, type SubmitEvent } from "react";

import { toIso, type Api } from "./breach-types";
import { warning } from "./BreachFields";
import BreachQuickReportFields, { type QuickReportDraft } from "./BreachQuickReportFields";

type Props = {
  open: boolean;
  onClose: () => void;
  api: Api;
  act: (fn: () => Promise<void>) => Promise<void>;
  load: () => Promise<void>;
};
function localNow(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function emptyForm(): QuickReportDraft {
  return {
    title: "",
    summary: "",
    discoveredAt: localNow(),
    occurredAt: "",
    howDiscovered: "",
    cause: "other",
    severity: "medium",
    dataCategories: [],
    involvesMinors: false,
  };
}

export default function BreachQuickReportForm({ open, onClose, api, act, load }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [form, setForm] = useState<QuickReportDraft>(emptyForm);
  useEffect(() => {
    if (!open) return;
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.showModal();
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    return () => triggerRef.current?.focus();
  }, [open]);
  function set<K extends keyof QuickReportDraft>(key: K, value: QuickReportDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const discoveredAt = toIso(form.discoveredAt);
    if (!discoveredAt) return;
    void act(async () => {
      await api("/api/admin/breaches/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, discoveredAt, occurredAt: toIso(form.occurredAt) }),
      });
      setForm(emptyForm());
      onClose();
      await load();
    });
  }
  if (!open) return null;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="breach-report-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[92dvh] w-[min(96vw,48rem)] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-xl backdrop:bg-[var(--text)]/60 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="breach-report-title" className="text-xl font-semibold">
            Report an incident
          </h2>
          <p className={warning}>
            For suspected incidents; a superadmin can complete the register after review.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 rounded-lg border border-[var(--border)] px-3"
        >
          Close
        </button>
      </div>
      <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm font-medium">
        Do not enter names or personal details of affected people. Use categories and counts only.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <BreachQuickReportFields form={form} set={set} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg border border-[var(--border)] px-4"
          >
            Cancel
          </button>
          <button className="min-h-10 rounded-lg bg-[var(--primary)] px-5 font-semibold text-[var(--on-primary)]">
            Submit incident report
          </button>
        </div>
      </form>
    </dialog>
  );
}
