import {
  DataCategoriesAndStatus,
  IncidentDetailsFields,
  NotificationAndClosureFields,
} from "./BreachEditorFields";
import { warning } from "./BreachFields";

import type { Draft } from "./breach-types";
import type { SubmitEvent } from "react";

type Props = {
  draft: Draft;
  selectedId: string;
  setDraft: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  submit: (event: SubmitEvent<HTMLFormElement>) => void;
  cancel: () => void;
};

export default function BreachEditor({ draft, selectedId, setDraft, submit, cancel }: Props) {
  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--text)]">
            {selectedId ? "Review and update incident" : "Create full incident record"}
          </h3>
          <p className={warning}>
            Superadmin controls. Status changes are validated and permanently recorded in the
            incident history.
          </p>
        </div>
        {selectedId && (
          <button
            type="button"
            onClick={cancel}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          >
            Cancel editing
          </button>
        )}
      </div>
      <IncidentDetailsFields draft={draft} setDraft={setDraft} />
      <DataCategoriesAndStatus
        draft={draft}
        setDraft={setDraft}
        allowStatusChange={Boolean(selectedId)}
      />
      <NotificationAndClosureFields draft={draft} setDraft={setDraft} />
      <button className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]">
        {selectedId ? "Save incident updates" : "Create incident"}
      </button>
    </form>
  );
}
