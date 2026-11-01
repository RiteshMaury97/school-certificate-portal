/* eslint-disable jsx-a11y/label-has-for, jsx-a11y/control-has-associated-label, jsx-a11y/no-noninteractive-element-interactions, @typescript-eslint/restrict-template-expressions -- reason: Existing compact admin form markup needs these targeted exceptions until the panel is decomposed. */
import { ShieldCheck, UploadCloud } from "lucide-react";
import { useState } from "react";

import { normalizeAcademicSession } from "@/shared/academic-session";
import { UPLOAD_LIMITS_HELP_TEXT } from "@/shared/upload-limits";

import DuplicateHashWarning from "../shared/DuplicateHashWarning";

import type {
  BulkPreviewItem,
  CatalogOption,
  NotifyState,
  StudentFormState,
} from "../../types/admin-state.types";
import type { Student } from "../../types/admin.types";
import type { Dispatch, SetStateAction, SubmitEventHandler, SubmitEvent } from "react";

type Props = {
  form: StudentFormState;
  setForm: Dispatch<SetStateAction<StudentFormState>>;
  sessionOptions: CatalogOption[];
  typeOptions: CatalogOption[];
  classOptions: CatalogOption[];
  notify: NotifyState;
  setNotify: Dispatch<SetStateAction<NotifyState>>;
  duplicateHashWarning: string;
  duplicateHashAcknowledged: boolean;
  duplicateHashReason: string;
  setDuplicateHashWarning: Dispatch<SetStateAction<string>>;
  setDuplicateHashAcknowledged: Dispatch<SetStateAction<boolean>>;
  setDuplicateHashReason: Dispatch<SetStateAction<string>>;
  busy: boolean;
  addStudent: SubmitEventHandler<HTMLFormElement>;
  bulkFiles: File[];
  setBulkFiles: Dispatch<SetStateAction<File[]>>;
  bulkCsv: File | null;
  setBulkCsv: Dispatch<SetStateAction<File | null>>;
  bulkPreview: BulkPreviewItem[];
  bulkProgress: Record<string, number>;
  previewBulk: () => Promise<void>;
  commitBulk: () => Promise<void>;
  students: Student[];
  selectedStudent: string;
  setSelectedStudent: Dispatch<SetStateAction<string>>;
  uploadCertificateDraft: (
    studentId: string,
    draft: { certificateType: string; certificateNumber: string; issuedAt: string; file: File },
  ) => Promise<{ ok: boolean; error?: string; duplicateFileWarning?: boolean }>;
  loadStudents: () => Promise<void>;
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
    notify,
    setNotify,
    duplicateHashWarning,
    duplicateHashAcknowledged,
    duplicateHashReason,
    setDuplicateHashWarning,
    setDuplicateHashAcknowledged,
    setDuplicateHashReason,
    busy,
    addStudent,
    bulkFiles,
    setBulkFiles,
    bulkCsv,
    setBulkCsv,
    bulkPreview,
    bulkProgress,
    previewBulk,
    commitBulk,
    students,
    selectedStudent,
    setSelectedStudent,
    uploadCertificateDraft,
    loadStudents,
  } = props;
  const [certificateRows, setCertificateRows] = useState([
    {
      id: "certificate-1",
      certificateType: "",
      certificateNumber: "",
      issuedAt: "",
      file: null as File | null,
    },
  ]);
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadingCertificates, setUploadingCertificates] = useState(false);

  async function addCertificates(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent) {
      setUploadError("Choose the student who owns these certificates.");
      return;
    }
    setUploadError("");
    setUploadMessage("");
    setUploadingCertificates(true);
    let uploaded = 0;
    try {
      for (let index = 0; index < certificateRows.length; index++) {
        const row = certificateRows[index]!;
        if (!row.file) {
          setUploadError(`Choose a file for certificate ${index + 1}.`);
          break;
        }
        if (!row.certificateType || !row.certificateNumber.trim() || !row.issuedAt) {
          setUploadError(
            `Complete the name, certificate number, issue date, and file for row ${index + 1}.`,
          );
          break;
        }
        const result = await uploadCertificateDraft(selectedStudent, {
          certificateType: row.certificateType,
          certificateNumber: row.certificateNumber,
          issuedAt: row.issuedAt,
          file: row.file,
        });
        if (!result.ok) {
          if (result.duplicateFileWarning)
            setDuplicateHashWarning(result.error ?? "A duplicate file needs review.");
          setUploadError(result.error ?? "Certificate upload failed.");
          break;
        }
        uploaded++;
        setCertificateRows((current) => current.filter((item) => item.id !== row.id));
      }
      if (uploaded) {
        await loadStudents();
        setUploadMessage(
          `${uploaded} certificate${uploaded === 1 ? "" : "s"} added to the student record.`,
        );
        setDuplicateHashAcknowledged(false);
        setDuplicateHashReason("");
        setDuplicateHashWarning("");
      }
    } finally {
      setUploadingCertificates(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              Student records
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Add student details</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Save the student profile first, then attach one or more named certificates below.
            </p>
          </div>
          <span
            title="Student information is encrypted at rest"
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-[var(--divider)] px-2.5 py-2 text-[10px] font-medium text-[var(--text-muted)] sm:inline-flex"
          >
            <ShieldCheck size={13} /> Encrypted at rest
          </span>
        </div>

        <form id="student-create-form" onSubmit={addStudent} className="mt-5">
          <div className="border-b border-[var(--divider)] pb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">
            Student information
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {studentFields.map(([key, label]) => (
              <label key={key} className="text-xs font-medium text-[var(--text)]">
                {label}
                <input
                  translate="no"
                  type={key === "dateOfBirth" ? "date" : "text"}
                  required={["studentName", "fatherName", "motherName", "scholarNumber"].includes(
                    key,
                  )}
                  minLength={
                    ["studentName", "fatherName", "motherName"].includes(key) ? 2 : undefined
                  }
                  maxLength={["studentName", "fatherName", "motherName"].includes(key) ? 100 : 40}
                  value={form[key]}
                  onChange={(event) => {
                    setForm((value) => ({ ...value, [key]: event.target.value }));
                  }}
                  className={fieldClass}
                />
              </label>
            ))}
            <label className="text-xs font-medium text-[var(--text)]">
              Class / section
              <select
                translate="no"
                required
                value={form.className}
                onChange={(event) => {
                  setForm((value) => ({ ...value, className: event.target.value }));
                }}
                className={fieldClass}
              >
                <option value="">Choose class</option>
                {classOptions.map((option) => (
                  <option key={option.id} value={option.label ?? option.name ?? option.id}>
                    {option.label ?? option.name ?? option.id}
                  </option>
                ))}
              </select>
              {classOptions.length === 0 && (
                <span className="mt-1 block text-[10px] text-[var(--danger)]">
                  Add a class in the Classes catalog before entering students.
                </span>
              )}
            </label>
            <label className="text-xs font-medium text-[var(--text)]">
              Academic session
              <select
                translate="no"
                required
                value={form.session}
                onChange={(event) => {
                  setForm((value) => ({ ...value, session: event.target.value }));
                }}
                className={fieldClass}
              >
                <option value="">Select session</option>
                {sessionOptions.map((option) => {
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

          <div className="mt-4 rounded-lg border border-[var(--divider)] bg-[var(--surface-2)] p-3">
            <h3 className="text-xs font-semibold text-[var(--text)]">
              Parent notification{" "}
              <span className="font-normal text-[var(--text-muted)]">
                · Optional, consent required
              </span>
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
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
                translate="no"
                value={notify.mobile}
                onChange={(event) => {
                  setNotify((value) => ({ ...value, mobile: event.target.value }));
                }}
                placeholder="Mobile with country code"
                className={fieldClass}
              />
            </div>
            <label className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-[var(--text-muted)]">
              <input
                translate="no"
                type="checkbox"
                checked={notify.consent}
                onChange={(event) => {
                  setNotify((value) => ({ ...value, consent: event.target.checked }));
                }}
                className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              />
              Parent/guardian has consented to receive a generic certificate-availability
              notification. Consent is recorded with timestamp and purpose; they can opt out at any
              time.
            </label>
          </div>

          <button
            disabled={busy || classOptions.length === 0}
            aria-busy={busy}
            className="mt-4 min-h-11 w-full rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60"
          >
            {busy ? "Saving student…" : "Save student details"}
          </button>
          <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
            The student record can be saved before certificate files are uploaded.
          </p>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-2">
          <UploadCloud size={17} className="mt-0.5 text-[var(--primary)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Add student documents</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Choose a student and attach multiple certificates. Give each file its own certificate
              name and number.
            </p>
          </div>
        </div>
        <form onSubmit={addCertificates} className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-[var(--text-muted)]">
            Student
            <select
              required
              value={selectedStudent}
              onChange={(event) => {
                setSelectedStudent(event.target.value);
              }}
              className={fieldClass}
            >
              <option value="">Choose student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentName} · {student.className} · {student.scholarNumber} ·{" "}
                  {student.session}
                </option>
              ))}
            </select>
          </label>
          {certificateRows.map((row, index) => (
            <div
              key={row.id}
              className="grid gap-3 rounded-lg border border-[var(--divider)] bg-[var(--surface-2)] p-3 sm:grid-cols-2"
            >
              <div className="flex items-center justify-between sm:col-span-2">
                <p className="text-xs font-semibold text-[var(--text)]">Certificate {index + 1}</p>
                {certificateRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCertificateRows((current) => current.filter((item) => item.id !== row.id));
                    }}
                    className="text-xs text-[var(--danger)]"
                  >
                    Remove
                  </button>
                )}
              </div>
              <label className="text-xs font-medium text-[var(--text-muted)]">
                Certificate name
                <select
                  required
                  value={row.certificateType}
                  onChange={(event) => {
                    setCertificateRows((current) =>
                      current.map((item) =>
                        item.id === row.id
                          ? { ...item, certificateType: event.target.value }
                          : item,
                      ),
                    );
                  }}
                  className={fieldClass}
                >
                  <option value="">Choose certificate type</option>
                  {typeOptions.map((option) => (
                    <option key={option.id} value={option.name ?? option.label ?? option.id}>
                      {option.name ?? option.label ?? option.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-[var(--text-muted)]">
                Certificate number
                <input
                  required
                  maxLength={80}
                  value={row.certificateNumber}
                  onChange={(event) => {
                    setCertificateRows((current) =>
                      current.map((item) =>
                        item.id === row.id
                          ? { ...item, certificateNumber: event.target.value }
                          : item,
                      ),
                    );
                  }}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-medium text-[var(--text-muted)]">
                Issue date
                <input
                  required
                  type="date"
                  value={row.issuedAt}
                  onChange={(event) => {
                    setCertificateRows((current) =>
                      current.map((item) =>
                        item.id === row.id ? { ...item, issuedAt: event.target.value } : item,
                      ),
                    );
                  }}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-medium text-[var(--text-muted)]">
                Document file
                <input
                  required
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => {
                    setCertificateRows((current) =>
                      current.map((item) =>
                        item.id === row.id
                          ? { ...item, file: event.target.files?.[0] ?? null }
                          : item,
                      ),
                    );
                  }}
                  className={fieldClass}
                />
              </label>
            </div>
          ))}
          {typeOptions.length === 0 && (
            <p className="text-xs text-[var(--danger)]">
              Add certificate types in School Catalog before uploading documents.
            </p>
          )}
          <DuplicateHashWarning
            warning={duplicateHashWarning}
            acknowledged={duplicateHashAcknowledged}
            reason={duplicateHashReason}
            setAcknowledged={setDuplicateHashAcknowledged}
            setReason={setDuplicateHashReason}
            className="rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4"
          />
          {uploadError && (
            <p
              role="alert"
              className="rounded-lg bg-[var(--danger)]/10 p-3 text-xs text-[var(--danger)]"
            >
              {uploadError}
            </p>
          )}
          {uploadMessage && (
            <p
              role="status"
              className="rounded-lg bg-[var(--success)]/10 p-3 text-xs text-[var(--success)]"
            >
              {uploadMessage}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCertificateRows((current) => [
                  ...current,
                  {
                    id: `certificate-${Date.now()}-${current.length}`,
                    certificateType: "",
                    certificateNumber: "",
                    issuedAt: "",
                    file: null,
                  },
                ]);
              }}
              className="min-h-10 rounded-lg border border-[var(--divider)] px-4 text-xs font-semibold text-[var(--text)]"
            >
              + Add another certificate
            </button>
            <button
              disabled={uploadingCertificates || !selectedStudent || typeOptions.length === 0}
              className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--on-primary)] disabled:opacity-50"
            >
              {uploadingCertificates ? "Uploading certificates…" : "Upload documents"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2">
          <UploadCloud size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">Bulk certificate upload</h3>
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Maximum 20 files; {UPLOAD_LIMITS_HELP_TEXT} Mapping CSV up to 2 MB.
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Upload up to 20 PDF, JPG or PNG files and map each to a student using a CSV.
        </p>
        <label
          className="mt-3 block rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-center text-xs text-[var(--text-muted)]"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            setBulkFiles(Array.from(event.dataTransfer.files));
          }}
        >
          Drop certificate files here or choose files
          <input
            translate="no"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(event) => {
              setBulkFiles(event.target.files ? Array.from(event.target.files) : []);
            }}
            className="mt-2 block w-full text-left text-xs"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            translate="no"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setBulkCsv(event.target.files?.[0] ?? null);
            }}
            className="min-h-9 min-w-0 flex-1 rounded-lg border border-[var(--divider)] p-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void previewBulk()}
            disabled={busy || !bulkCsv || !bulkFiles.length}
            className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium disabled:opacity-50"
          >
            Validate & preview
          </button>
        </div>
        {bulkPreview.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--divider)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-2)]">
                <tr>
                  <th className="p-2">File</th>
                  <th className="p-2">Size</th>
                  <th className="p-2">Validation</th>
                  <th className="p-2">Progress</th>
                </tr>
              </thead>
              <tbody>
                {bulkPreview.map((row) => (
                  <tr key={row.fileName} className="border-t border-[var(--divider)]">
                    <td className="p-2">{row.fileName}</td>
                    <td className="p-2">{Math.ceil(row.size / 1024)} KB</td>
                    <td className="p-2">{row.valid ? "Ready" : row.errors.join("; ")}</td>
                    <td className="p-2">
                      {bulkProgress[row.fileName] === 100
                        ? "Complete"
                        : `${bulkProgress[row.fileName] ?? 0}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {bulkPreview.length > 0 && (
          <>
            <DuplicateHashWarning
              warning={duplicateHashWarning}
              acknowledged={duplicateHashAcknowledged}
              reason={duplicateHashReason}
              setAcknowledged={setDuplicateHashAcknowledged}
              setReason={setDuplicateHashReason}
              className="mt-3 rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4"
            />
            <button
              type="button"
              onClick={() => void commitBulk()}
              disabled={
                busy ||
                !bulkPreview.some((item) => item.valid) ||
                (Boolean(duplicateHashWarning) &&
                  (!duplicateHashAcknowledged || duplicateHashReason.trim().length < 10))
              }
              className="mt-3 min-h-10 rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--on-primary)] disabled:opacity-50"
            >
              Commit / retry remaining uploads
            </button>
          </>
        )}
      </section>
    </div>
  );
}
