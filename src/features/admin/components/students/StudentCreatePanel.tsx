/* eslint-disable jsx-a11y/label-has-for, jsx-a11y/control-has-associated-label, jsx-a11y/no-noninteractive-element-interactions, @typescript-eslint/restrict-template-expressions */
import { Download, FileText, ShieldCheck, UploadCloud } from "lucide-react";
import { normalizeAcademicSession } from "@/shared/academic-session";

import DuplicateHashWarning from "../shared/DuplicateHashWarning";

import type { BulkPreviewItem, CatalogOption, NotifyState, StudentFormState } from "../../types/admin-state.types";
import type { Dispatch, SetStateAction, SubmitEventHandler } from "react";

type Props = {
  form: StudentFormState; setForm: Dispatch<SetStateAction<StudentFormState>>; sessionOptions: CatalogOption[]; typeOptions: CatalogOption[]; classOptions: CatalogOption[];
  files: File[]; setFiles: Dispatch<SetStateAction<File[]>>; notify: NotifyState; setNotify: Dispatch<SetStateAction<NotifyState>>;
  duplicateHashWarning: string; duplicateHashAcknowledged: boolean; duplicateHashReason: string;
  setDuplicateHashAcknowledged: Dispatch<SetStateAction<boolean>>; setDuplicateHashReason: Dispatch<SetStateAction<string>>;
  busy: boolean; addStudent: SubmitEventHandler<HTMLFormElement>; downloadTemplate: (format: "csv" | "xlsx") => Promise<void>;
  csv: File | null; setCsv: Dispatch<SetStateAction<File | null>>; importCsv: (action: "preview" | "commit") => Promise<void>;
  preview: Record<string, unknown> | null; bulkFiles: File[]; setBulkFiles: Dispatch<SetStateAction<File[]>>;
  bulkCsv: File | null; setBulkCsv: Dispatch<SetStateAction<File | null>>; bulkPreview: BulkPreviewItem[];
  bulkProgress: Record<string, number>; previewBulk: () => Promise<void>; commitBulk: () => Promise<void>;
};

const studentFields = [
  ["admissionNumber", "Admission number"],
  ["dateOfBirth", "Date of birth"],
  ["studentName", "Student name"],
  ["fatherName", "Father name"],
  ["motherName", "Mother name"],
  ["scholarNumber", "Scholar number"],
] as const;

const certificateFields = [
  ["certificateNumber", "Certificate number"],
  ["issuedAt", "Issue date"],
] as const;

const fieldClass = "mt-1.5 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]";

type RowError = { row: unknown; error: unknown };
function getRowErrors(value: unknown): RowError[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item: unknown): item is RowError =>
    typeof item === "object" && item !== null && "row" in item && "error" in item,
  );
}

export default function StudentCreatePanel(props: Props) {
  const { form, setForm, sessionOptions, typeOptions, classOptions, files, setFiles, notify, setNotify,
    duplicateHashWarning, duplicateHashAcknowledged, duplicateHashReason, setDuplicateHashAcknowledged,
    setDuplicateHashReason, busy, addStudent, downloadTemplate, csv, setCsv, importCsv, preview,
    bulkFiles, setBulkFiles, bulkCsv, setBulkCsv, bulkPreview, bulkProgress, previewBulk, commitBulk } = props;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Student records</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Add student and certificate</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Enter student details once, then attach the certificate and notify parents when consent is provided.</p>
          </div>
          <span title="Student information is encrypted at rest" className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-[var(--divider)] px-2.5 py-2 text-[10px] font-medium text-[var(--text-muted)] sm:inline-flex"><ShieldCheck size={13} /> Encrypted at rest</span>
        </div>

        <form id="student-create-form" onSubmit={addStudent} className="mt-5">
          <div className="border-b border-[var(--divider)] pb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">Student information</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {studentFields.map(([key, label]) => (
              <label key={key} className="text-xs font-medium text-[var(--text)]">
                {label}
                <input
                  translate="no"
                  type={key === "dateOfBirth" ? "date" : "text"}
                  required={["studentName", "fatherName", "motherName", "className", "scholarNumber"].includes(key)}
                  minLength={["studentName", "fatherName", "motherName"].includes(key) ? 2 : undefined}
                  maxLength={["studentName", "fatherName", "motherName"].includes(key) ? 100 : 40}
                  value={form[key]}
                  onChange={(event) => { setForm((value) => ({ ...value, [key]: event.target.value })); }}
                  className={fieldClass}
                />
              </label>
            ))}
            <label className="text-xs font-medium text-[var(--text)]">
              Class / section
              <select translate="no" required value={form.className} onChange={(event) => { setForm((value) => ({ ...value, className: event.target.value })); }} className={fieldClass}>
                <option value="">Choose class</option>
                {classOptions.map((option) => <option key={option.id} value={option.label ?? option.name ?? option.id}>{option.label ?? option.name ?? option.id}</option>)}
              </select>
              {classOptions.length === 0 && <span className="mt-1 block text-[10px] text-[var(--danger)]">Add a class in the Classes catalog before entering students.</span>}
            </label>
            <label className="text-xs font-medium text-[var(--text)]">
              Academic session
              <select translate="no" required value={form.session} onChange={(event) => { setForm((value) => ({ ...value, session: event.target.value })); }} className={fieldClass}>
                <option value="">Select session</option>
                {sessionOptions.map((option) => {
                  const value = normalizeAcademicSession(option.label ?? "")
                    ?? normalizeAcademicSession(option.name ?? "")
                    ?? normalizeAcademicSession(option.id);
                  return value ? (
                    <option key={option.id} value={value}>
                      {option.label ?? option.name ?? option.id}
                    </option>
                  ) : null;
                })}
              </select>
            </label>
          </div>

          <div className="mt-5 border-b border-[var(--divider)] pb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">Certificate details</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-[var(--text)]">
              Certificate type
              <select translate="no" required value={form.certificateType} onChange={(event) => { setForm((value) => ({ ...value, certificateType: event.target.value })); }} className={fieldClass}>
                <option value="">Select certificate type</option>
                {typeOptions.map((option) => <option key={option.id} value={option.name ?? option.label ?? option.id}>{option.name ?? option.label ?? option.id}</option>)}
              </select>
            </label>
            {certificateFields.map(([key, label]) => (
              <label key={key} className="text-xs font-medium text-[var(--text)]">
                {label}
                <input
                  translate="no"
                  type={key === "issuedAt" ? "date" : "text"}
                  required
                  maxLength={key === "certificateNumber" ? 80 : undefined}
                  value={form[key]}
                  onChange={(event) => { setForm((value) => ({ ...value, [key]: event.target.value })); }}
                  className={fieldClass}
                />
              </label>
            ))}
            <label className="text-xs font-medium text-[var(--text)] sm:col-span-2">
              Certificate file
              <input translate="no" required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => { setFiles(event.target.files ? Array.from(event.target.files) : []); }} className="mt-1.5 block min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2 text-xs text-[var(--text-muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--text)]" />
              {files[0] && <span className="mt-1 block text-[10px] text-[var(--text-muted)]">Selected: {files[0].name}</span>}
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--divider)] bg-[var(--surface-2)] p-3">
            <h3 className="text-xs font-semibold text-[var(--text)]">Parent notification <span className="font-normal text-[var(--text-muted)]">· Optional, consent required</span></h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input translate="no" type="email" value={notify.email} onChange={(event) => { setNotify((value) => ({ ...value, email: event.target.value })); }} placeholder="Parent email address" className={fieldClass} />
              <input translate="no" value={notify.mobile} onChange={(event) => { setNotify((value) => ({ ...value, mobile: event.target.value })); }} placeholder="Mobile with country code" className={fieldClass} />
            </div>
            <label className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-[var(--text-muted)]">
              <input translate="no" type="checkbox" checked={notify.consent} onChange={(event) => { setNotify((value) => ({ ...value, consent: event.target.checked })); }} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
              Parent/guardian has consented to receive a generic certificate-availability notification. Consent is recorded with timestamp and purpose; they can opt out at any time.
            </label>
          </div>

          <DuplicateHashWarning warning={duplicateHashWarning} acknowledged={duplicateHashAcknowledged} reason={duplicateHashReason} setAcknowledged={setDuplicateHashAcknowledged} setReason={setDuplicateHashReason} className="mt-4 rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4" />
          <button disabled={busy || (Boolean(duplicateHashWarning) && (!duplicateHashAcknowledged || duplicateHashReason.trim().length < 10))} aria-busy={busy} className="mt-4 min-h-11 w-full rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60">
            {busy ? "Saving student and certificate…" : "Save student and certificate"}
          </button>
          <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">Duplicate admission and certificate numbers are checked before saving.</p>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2"><FileText size={16} className="text-[var(--primary)]" /><h3 className="text-sm font-semibold text-[var(--text)]">Bulk import students</h3></div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Upload a CSV or Excel template to add multiple student records.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadTemplate("csv")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium"><Download size={13} /> CSV template</button>
          <button type="button" onClick={() => void downloadTemplate("xlsx")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium"><Download size={13} /> Excel template</button>
          <input translate="no" type="file" accept=".csv,text/csv" onChange={(event) => { setCsv(event.target.files?.[0] ?? null); }} className="min-h-9 min-w-0 flex-1 rounded-lg border border-[var(--divider)] p-1.5 text-xs" />
          <button type="button" onClick={() => void importCsv("preview")} disabled={!csv || busy} className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium disabled:opacity-50">Preview & validate</button>
          <button type="button" onClick={() => void importCsv("commit")} disabled={!csv || busy || !preview || Number(preview.valid) !== Number(preview.total)} className="min-h-9 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--on-primary)] disabled:opacity-50">Commit import</button>
        </div>
        <p className="mt-2 text-[10px] text-[var(--text-muted)]">Required columns: studentName, fatherName, motherName, className, scholarNumber and session.</p>
        {preview && <div className="mt-3 rounded-lg bg-[var(--surface-2)] p-3 text-xs"><p>Rows: {String(preview.total)} · Valid: {String(preview.valid)} · Errors: {getRowErrors(preview.errors).length}</p>{getRowErrors(preview.errors).map((item, index) => <p key={index} className="mt-1 text-[var(--danger)]">Row {String(item.row)}: {String(item.error)}</p>)}</div>}
      </section>

      <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2"><UploadCloud size={16} className="text-[var(--primary)]" /><h3 className="text-sm font-semibold text-[var(--text)]">Bulk certificate upload</h3></div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Upload up to 20 PDF, JPG or PNG files and map each to a student using a CSV.</p>
        <label className="mt-3 block rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-center text-xs text-[var(--text-muted)]" onDragOver={(event) => { event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); setBulkFiles(Array.from(event.dataTransfer.files)); }}>
          Drop certificate files here or choose files
          <input translate="no" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => { setBulkFiles(event.target.files ? Array.from(event.target.files) : []); }} className="mt-2 block w-full text-left text-xs" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <input translate="no" type="file" accept=".csv,text/csv" onChange={(event) => { setBulkCsv(event.target.files?.[0] ?? null); }} className="min-h-9 min-w-0 flex-1 rounded-lg border border-[var(--divider)] p-1.5 text-xs" />
          <button type="button" onClick={() => void previewBulk()} disabled={busy || !bulkCsv || !bulkFiles.length} className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium disabled:opacity-50">Validate & preview</button>
        </div>
        {bulkPreview.length > 0 && <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--divider)]"><table className="w-full text-left text-xs"><thead className="bg-[var(--surface-2)]"><tr><th className="p-2">File</th><th className="p-2">Size</th><th className="p-2">Validation</th><th className="p-2">Progress</th></tr></thead><tbody>{bulkPreview.map((row) => <tr key={row.fileName} className="border-t border-[var(--divider)]"><td className="p-2">{row.fileName}</td><td className="p-2">{Math.ceil(row.size / 1024)} KB</td><td className="p-2">{row.valid ? "Ready" : row.errors.join("; ")}</td><td className="p-2">{bulkProgress[row.fileName] === 100 ? "Complete" : `${bulkProgress[row.fileName] ?? 0}%`}</td></tr>)}</tbody></table></div>}
        {bulkPreview.length > 0 && <><DuplicateHashWarning warning={duplicateHashWarning} acknowledged={duplicateHashAcknowledged} reason={duplicateHashReason} setAcknowledged={setDuplicateHashAcknowledged} setReason={setDuplicateHashReason} className="mt-3 rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4" /><button type="button" onClick={() => void commitBulk()} disabled={busy || !bulkPreview.some((item) => item.valid) || (Boolean(duplicateHashWarning) && (!duplicateHashAcknowledged || duplicateHashReason.trim().length < 10))} className="mt-3 min-h-10 rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--on-primary)] disabled:opacity-50">Commit / retry remaining uploads</button></>}
      </section>
    </div>
  );
}
