import { ShieldCheck } from "lucide-react";

import { normalizeAcademicSession } from "@/shared/academic-session";

import DuplicateHashWarning from "../shared/DuplicateHashWarning";

import type {
  CatalogOption,
  NotifyState,
  StudentFormState,
} from "../../types/admin-state.types";
import type { Dispatch, SetStateAction, SubmitEventHandler } from "react";

type Props = {
  form: StudentFormState;
  setForm: Dispatch<SetStateAction<StudentFormState>>;
  sessionOptions: CatalogOption[];
  typeOptions: CatalogOption[];
  classOptions: CatalogOption[];
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
  notify: NotifyState;
  setNotify: Dispatch<SetStateAction<NotifyState>>;
  duplicateHashWarning: string;
  duplicateHashAcknowledged: boolean;
  duplicateHashReason: string;
  setDuplicateHashAcknowledged: Dispatch<SetStateAction<boolean>>;
  setDuplicateHashReason: Dispatch<SetStateAction<string>>;
  busy: boolean;
  addStudent: SubmitEventHandler<HTMLFormElement>;
};

const studentFields = [
  ["admissionNumber", "Admission number"],
  ["dateOfBirth", "Date of birth"],
  ["studentName", "Student name"],
  ["fatherName", "Father name"],
  ["motherName", "Mother name"],
  ["scholarNumber", "Scholar number"],
] as const;

const fieldClass =
  "mt-1.5 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]";

export default function StudentCreatePanel(props: Props) {
  const {
    form,
    setForm,
    sessionOptions,
    typeOptions,
    classOptions,
    files,
    setFiles,
    notify,
    setNotify,
    duplicateHashWarning,
    duplicateHashAcknowledged,
    duplicateHashReason,
    setDuplicateHashAcknowledged,
    setDuplicateHashReason,
    busy,
    addStudent,
  } = props;

  return (
    <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            Manual entry
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
            Add one student and certificate
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Use this form for a single record. For class lists, go to Import
            Students and upload an Excel workbook.
          </p>
        </div>
        <span
          title="Student information is encrypted at rest"
          className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-[var(--divider)] px-2.5 py-2 text-[10px] font-medium text-[var(--text-muted)] sm:inline-flex"
        >
          <ShieldCheck size={13} aria-hidden="true" /> Encrypted at rest
        </span>
      </div>

      <form id="student-create-form" onSubmit={addStudent} className="mt-5">
        <div className="border-b border-[var(--divider)] pb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">
          Student information
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {studentFields.map(([key, label]) => (
            <label
              key={key}
              htmlFor={`student-${key}`}
              className="text-xs font-medium text-[var(--text)]"
            >
              {label}
              <input
                id={`student-${key}`}
                translate="no"
                type={key === "dateOfBirth" ? "date" : "text"}
                required={[
                  "studentName",
                  "fatherName",
                  "motherName",
                  "scholarNumber",
                ].includes(key)}
                minLength={
                  ["studentName", "fatherName", "motherName"].includes(key)
                    ? 2
                    : undefined
                }
                maxLength={
                  ["studentName", "fatherName", "motherName"].includes(key)
                    ? 100
                    : 80
                }
                value={form[key]}
                onChange={(event) => {
                  setForm((value) => ({ ...value, [key]: event.target.value }));
                }}
                className={fieldClass}
              />
            </label>
          ))}
          <label
            htmlFor="student-class"
            className="text-xs font-medium text-[var(--text)]"
          >
            Class / section
            <select
              id="student-class"
              translate="no"
              required
              value={form.className}
              onChange={(event) => {
                setForm((value) => ({ ...value, className: event.target.value }));
              }}
              className={fieldClass}
            >
              <option value="">Choose class</option>
              {classOptions
                .filter((option) => option.isActive !== false)
                .map((option) => {
                  const label = option.label ?? option.name ?? option.id;
                  return (
                    <option key={option.id} value={label}>
                      {label}
                    </option>
                  );
                })}
            </select>
            {classOptions.length === 0 && (
              <span className="mt-1 block text-[10px] text-[var(--danger)]">
                Add a class in the Classes catalog before entering students.
              </span>
            )}
          </label>
          <label
            htmlFor="student-session"
            className="text-xs font-medium text-[var(--text)]"
          >
            Academic session
            <select
              id="student-session"
              translate="no"
              required
              value={form.session}
              onChange={(event) => {
                setForm((value) => ({ ...value, session: event.target.value }));
              }}
              className={fieldClass}
            >
              <option value="">Select session</option>
              {sessionOptions
                .filter((option) => option.isActive !== false)
                .map((option) => {
                  const value =
                    normalizeAcademicSession(option.label ?? "") ??
                    normalizeAcademicSession(option.name ?? "") ??
                    normalizeAcademicSession(option.id);
                  return value ? (
                    <option key={option.id} value={value}>
                      {option.label ?? option.name ?? option.id}
                    </option>
                  ) : null;
                })}
            </select>
          </label>
        </div>

        <div className="mt-5 border-b border-[var(--divider)] pb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">
          Certificate details
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label
            htmlFor="certificate-type"
            className="text-xs font-medium text-[var(--text)]"
          >
            Certificate type
            <select
              id="certificate-type"
              translate="no"
              required
              value={form.certificateType}
              onChange={(event) => {
                setForm((value) => ({
                  ...value,
                  certificateType: event.target.value,
                }));
              }}
              className={fieldClass}
            >
              <option value="">Select certificate type</option>
              {typeOptions
                .filter((option) => option.isActive !== false)
                .map((option) => (
                  <option key={option.id} value={option.name ?? option.label ?? option.id}>
                    {option.name ?? option.label ?? option.id}
                  </option>
                ))}
            </select>
          </label>
          <label
            htmlFor="certificate-number"
            className="text-xs font-medium text-[var(--text)]"
          >
            Certificate number
            <input
              id="certificate-number"
              translate="no"
              required
              maxLength={80}
              value={form.certificateNumber}
              onChange={(event) => {
                setForm((value) => ({
                  ...value,
                  certificateNumber: event.target.value,
                }));
              }}
              className={fieldClass}
            />
          </label>
          <label
            htmlFor="certificate-issued-at"
            className="text-xs font-medium text-[var(--text)]"
          >
            Issue date
            <input
              id="certificate-issued-at"
              translate="no"
              type="date"
              required
              value={form.issuedAt}
              onChange={(event) => {
                setForm((value) => ({ ...value, issuedAt: event.target.value }));
              }}
              className={fieldClass}
            />
          </label>
          <label
            htmlFor="certificate-file"
            className="text-xs font-medium text-[var(--text)]"
          >
            Certificate file
            <input
              id="certificate-file"
              translate="no"
              required
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => {
                setFiles(event.target.files ? Array.from(event.target.files) : []);
              }}
              className={fieldClass}
            />
            {files[0] && (
              <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                Selected: {files[0].name}
              </span>
            )}
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--divider)] bg-[var(--surface-2)] p-3">
          <h3 className="text-xs font-semibold text-[var(--text)]">
            Parent notification{" "}
            <span className="font-normal text-[var(--text-muted)]">
              · Optional, consent required
            </span>
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              aria-label="Parent email address"
              translate="no"
              type="email"
              value={notify.email}
              onChange={(event) => {
                setNotify((value) => ({ ...value, email: event.target.value }));
              }}
              placeholder="Parent email address"
              className={fieldClass}
            />
            <input
              aria-label="Parent mobile number with country code"
              translate="no"
              value={notify.mobile}
              onChange={(event) => {
                setNotify((value) => ({ ...value, mobile: event.target.value }));
              }}
              placeholder="Mobile with country code"
              className={fieldClass}
            />
          </div>
          <label
            htmlFor="parent-notification-consent"
            className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-[var(--text-muted)]"
          >
            <input
              id="parent-notification-consent"
              type="checkbox"
              checked={notify.consent}
              onChange={(event) => {
                setNotify((value) => ({ ...value, consent: event.target.checked }));
              }}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            Parent/guardian has consented to receive a generic certificate
            availability notification. Consent is recorded with timestamp and
            purpose; they can opt out at any time.
          </label>
        </div>

        <DuplicateHashWarning
          warning={duplicateHashWarning}
          acknowledged={duplicateHashAcknowledged}
          reason={duplicateHashReason}
          setAcknowledged={setDuplicateHashAcknowledged}
          setReason={setDuplicateHashReason}
          className="mt-4 rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4"
        />
        <button
          disabled={
            busy ||
            (Boolean(duplicateHashWarning) &&
              (!duplicateHashAcknowledged || duplicateHashReason.trim().length < 10))
          }
          aria-busy={busy}
          className="mt-4 min-h-11 w-full rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60"
        >
          {busy ? "Saving student and certificate…" : "Save student and certificate"}
        </button>
        <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
          Duplicate admission and certificate numbers are checked before saving.
        </p>
      </form>
    </section>
  );
}
