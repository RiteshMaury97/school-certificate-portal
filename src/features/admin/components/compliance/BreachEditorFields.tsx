import { useId } from "react";

import { isStatus, statusOptions, type Draft } from "./breach-types";
import { inputClass, TextArea, TextField } from "./BreachFields";

type SetDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => void;
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <select
        id={id}
        aria-label={label}
        className={inputClass}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("-", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export function IncidentDetailsFields({ draft, setDraft }: { draft: Draft; setDraft: SetDraft }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField
        label="Title"
        value={draft.title}
        required
        onChange={(value) => {
          setDraft("title", value);
        }}
      />
      <TextField
        label="Incident lead admin UID"
        value={draft.incidentLead}
        required
        onChange={(value) => {
          setDraft("incidentLead", value);
        }}
      />
      <TextArea
        label="Summary of what happened"
        value={draft.summary}
        required
        minLength={10}
        onChange={(value) => {
          setDraft("summary", value);
        }}
      />
      <TextArea
        label="How discovered"
        value={draft.howDiscovered}
        required
        maxLength={1000}
        onChange={(value) => {
          setDraft("howDiscovered", value);
        }}
      />
      <TextField
        label="Occurred at (leave blank if unknown)"
        type="datetime-local"
        value={draft.occurredAt}
        onChange={(value) => {
          setDraft("occurredAt", value);
        }}
      />
      <TextField
        label="Discovered at"
        type="datetime-local"
        value={draft.discoveredAt}
        required
        onChange={(value) => {
          setDraft("discoveredAt", value);
        }}
      />
      <SelectField
        label="Cause"
        value={draft.cause}
        options={[
          "unauthorized-access",
          "lost-or-stolen-device",
          "misdirected-message",
          "system-error",
          "malware",
          "insider",
          "other",
        ]}
        onChange={(value) => {
          setDraft("cause", value);
        }}
      />
      <SelectField
        label="Severity"
        value={draft.severity}
        options={["low", "medium", "high", "critical"]}
        onChange={(value) => {
          setDraft("severity", value);
        }}
      />
      <TextArea
        label="Systems affected"
        value={draft.systemsAffected}
        maxLength={1000}
        onChange={(value) => {
          setDraft("systemsAffected", value);
        }}
      />
      <TextField
        label="Estimated affected people (count only)"
        type="number"
        value={draft.affectedPrincipalsEstimate}
        onChange={(value) => {
          setDraft("affectedPrincipalsEstimate", value);
        }}
      />
      <TextArea
        label="Containment actions"
        value={draft.containmentActions}
        onChange={(value) => {
          setDraft("containmentActions", value);
        }}
      />
      <TextArea
        label="Likely consequences"
        value={draft.likelyConsequences}
        onChange={(value) => {
          setDraft("likelyConsequences", value);
        }}
      />
    </div>
  );
}

export function DataCategoriesAndStatus({
  draft,
  setDraft,
  allowStatusChange,
}: {
  draft: Draft;
  setDraft: SetDraft;
  allowStatusChange: boolean;
}) {
  const categories = [
    "student-names",
    "parent-names",
    "session-and-class",
    "certificate-files",
    "contact-details",
    "admin-credentials",
    "other",
  ];
  return (
    <div className="space-y-4">
      <fieldset className="rounded-xl border border-[var(--border)] p-4">
        <legend className="px-1 text-sm font-semibold">Data categories affected</legend>
        <p className="mt-1 text-[11px] leading-4 text-[var(--text-muted)]">
          Select categories only; never list people or contact details.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const id = `breach-category-${category}`;
            return (
              <label key={category} htmlFor={id} className="flex items-center gap-2 text-sm">
                <input
                  id={id}
                  aria-label={category.replaceAll("-", " ")}
                  type="checkbox"
                  checked={draft.dataCategories.includes(category)}
                  onChange={(event) => {
                    setDraft(
                      "dataCategories",
                      event.target.checked
                        ? [...draft.dataCategories, category]
                        : draft.dataCategories.filter((entry) => entry !== category),
                    );
                  }}
                />
                {category.replaceAll("-", " ")}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        <label htmlFor="breach-minors" className="flex items-center gap-2 text-sm">
          <input
            id="breach-minors"
            aria-label="Involves minors"
            type="checkbox"
            checked={draft.involvesMinors}
            onChange={(event) => {
              setDraft("involvesMinors", event.target.checked);
            }}
          />
          Involves minors
        </label>
        {allowStatusChange ? (
          <SelectField
            label="Status"
            value={draft.status}
            options={statusOptions}
            onChange={(value) => {
              if (isStatus(value)) setDraft("status", value);
            }}
          />
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Initial status:{" "}
            <strong className="capitalize text-[var(--text)]">{draft.status}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

export function NotificationAndClosureFields({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: SetDraft;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <TextField
          label="Board notified at"
          type="datetime-local"
          value={draft.boardNotifiedAt}
          onChange={(value) => {
            setDraft("boardNotifiedAt", value);
          }}
        />
        <TextField
          label="Board detailed report at"
          type="datetime-local"
          value={draft.boardDetailedReportAt}
          onChange={(value) => {
            setDraft("boardDetailedReportAt", value);
          }}
        />
        <TextField
          label="Principals notified at"
          type="datetime-local"
          value={draft.principalsNotifiedAt}
          onChange={(value) => {
            setDraft("principalsNotifiedAt", value);
          }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TextArea
          label="Root cause (required to close)"
          value={draft.rootCause}
          onChange={(value) => {
            setDraft("rootCause", value);
          }}
        />
        <TextArea
          label="Corrective actions (required to close)"
          value={draft.correctiveActions}
          onChange={(value) => {
            setDraft("correctiveActions", value);
          }}
        />
        <TextArea
          label="Lessons learned (required to close)"
          value={draft.lessonsLearned}
          onChange={(value) => {
            setDraft("lessonsLearned", value);
          }}
        />
        <TextArea
          label="Reason notifications were not required (if applicable)"
          value={draft.notificationExceptionReason}
          maxLength={1000}
          onChange={(value) => {
            setDraft("notificationExceptionReason", value);
          }}
        />
      </div>
    </>
  );
}
