"use client";

import { FilePlus2, Search, ShieldCheck, UsersRound, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import EmptyState from "@/components/feedback/EmptyState";
import { DatePicker } from "@/components/ui/DatePicker";
import { appCheckHeaders } from "@/lib/firebase-client";
import { UPLOAD_LIMITS_HELP } from "@/shared/upload-limits";

import { csrf } from "../../utils/admin-helpers";
import DuplicateHashWarning from "../shared/DuplicateHashWarning";

import type { CatalogOption } from "../../types/admin-state.types";
import type { Role, Student, Tab } from "../../types/admin.types";
import type { Dispatch, SetStateAction } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;

type StudentForm = Pick<
  Student,
  "studentName" | "fatherName" | "motherName" | "className" | "scholarNumber" | "session"
> & {
  admissionNumber: string;
  dateOfBirth: string;
};

type CertificateForm = {
  certificateType: string;
  certificateNumber: string;
  issuedAt: string;
};

type Props = {
  role: Role;
  students: Student[];
  typeOptions: CatalogOption[];
  classOptions: CatalogOption[];
  sessionOptions: CatalogOption[];
  setTimelineStudentId: Dispatch<SetStateAction<string>>;
  setTab: (tab: Tab) => void;
  api: Api;
  loadStudents: () => Promise<void>;
  removeStudent: (student: Student) => Promise<void>;
};

const fields: {
  key: keyof StudentForm;
  label: string;
  required?: boolean;
  type?: string;
}[] = [
  { key: "studentName", label: "Student name", required: true },
  { key: "fatherName", label: "Father name", required: true },
  { key: "motherName", label: "Mother name", required: true },
  { key: "className", label: "Class / section", required: true },
  { key: "scholarNumber", label: "Scholar number", required: true },
  { key: "session", label: "Academic session", required: true },
  { key: "admissionNumber", label: "Admission number" },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
];

const controlClass =
  "min-h-10 w-full rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]";
const cellClass = "px-3 py-3 align-top text-left text-xs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionLabel(option: CatalogOption): string {
  return option.label ?? option.name ?? option.id;
}

function choices(options: CatalogOption[], records: string[]): string[] {
  return [
    ...new Set([
      ...options
        .filter((option) => option.isActive !== false)
        .map(optionLabel)
        .filter(Boolean),
      ...records.filter(Boolean),
    ]),
  ].sort((left, right) => left.localeCompare(right));
}

function certificateDefaults(): CertificateForm {
  return { certificateType: "", certificateNumber: "", issuedAt: "" };
}

export default function StudentsList({
  role,
  students,
  typeOptions,
  classOptions,
  sessionOptions,
  setTimelineStudentId,
  setTab,
  api,
  loadStudents,
  removeStudent,
}: Props) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<StudentForm | null>(null);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [editMessage, setEditMessage] = useState("");
  const [certificateStudent, setCertificateStudent] = useState<Student | null>(null);
  const [certificate, setCertificate] = useState(certificateDefaults);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificateError, setCertificateError] = useState("");
  const [certificateWarning, setCertificateWarning] = useState("");
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [duplicateReason, setDuplicateReason] = useState("");
  const [notice, setNotice] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  const classNames = useMemo(
    () =>
      choices(
        classOptions,
        students.map((student) => student.className),
      ),
    [classOptions, students],
  );
  const sessionNames = useMemo(
    () =>
      choices(
        sessionOptions,
        students.map((student) => student.session),
      ),
    [sessionOptions, students],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSearch =
        !query ||
        [
          student.studentName,
          student.fatherName,
          student.motherName,
          student.scholarNumber,
          student.admissionNo,
          student.className,
          student.session,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return (
        matchesSearch &&
        (!classFilter || student.className === classFilter) &&
        (!sessionFilter || student.session === sessionFilter)
      );
    });
  }, [classFilter, search, sessionFilter, students]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15));
  const visible = filtered.slice(page * 15, page * 15 + 15);

  function closeCertificateDialog() {
    setCertificateStudent(null);
    setCertificate(certificateDefaults());
    setCertificateFile(null);
    setCertificateError("");
    setCertificateWarning("");
    setDuplicateAcknowledged(false);
    setDuplicateReason("");
  }

  async function openEditor(student: Student) {
    setEditing(student);
    setEditForm({
      studentName: student.studentName,
      fatherName: student.fatherName,
      motherName: student.motherName,
      className: student.className,
      scholarNumber: student.scholarNumber,
      session: student.session,
      admissionNumber: student.admissionNo ?? "",
      dateOfBirth: student.dateOfBirth ?? "",
    });
    setHistory([]);
    setEditMessage("");
    try {
      const result = await api<{ events?: Record<string, unknown>[] }>(
        `/api/admin/timeline?studentId=${encodeURIComponent(student.id)}`,
      );
      setHistory(result.events ?? []);
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : "Unable to load change history.");
    }
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editForm) return;
    setSavingEdit(true);
    setEditMessage("");
    try {
      await api(`/api/admin/students/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      await loadStudents();
      setEditMessage("Student details saved and recorded in the audit log.");
      setEditing((current) =>
        current
          ? {
              ...current,
              ...editForm,
              admissionNo: editForm.admissionNumber,
            }
          : current,
      );
    } catch (error) {
      setEditMessage(error instanceof Error ? error.message : "Unable to save student details.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function addCertificate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!certificateStudent || !certificateFile) {
      setCertificateError("Choose a certificate file first.");
      return;
    }
    setUploadingCertificate(true);
    setCertificateError("");
    try {
      const body = new FormData();
      body.append("studentId", certificateStudent.id);
      body.append("session", certificateStudent.session);
      body.append("certificateType", certificate.certificateType);
      body.append("certificateNumber", certificate.certificateNumber);
      body.append("issuedAt", certificate.issuedAt);
      body.append("file", certificateFile);
      body.append("confirmDuplicateHash", String(duplicateAcknowledged));
      body.append("duplicateHashReason", duplicateReason);
      const response = await fetch("/api/admin/certificates", {
        method: "POST",
        body,
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
      const result: unknown = await response.json().catch(() => ({}));
      if (!isRecord(result))
        throw new Error("The certificate service returned an invalid response.");
      if (!response.ok) {
        const message =
          typeof result.error === "string" ? result.error : "Certificate upload failed.";
        if (result.duplicateFileWarning === true) setCertificateWarning(message);
        throw new Error(message);
      }
      await loadStudents();
      closeCertificateDialog();
      setNotice(`Certificate added to ${certificateStudent.studentName}.`);
    } catch (error) {
      setCertificateError(error instanceof Error ? error.message : "Certificate upload failed.");
    } finally {
      setUploadingCertificate(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--divider)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
            <UsersRound size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              Student records
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Student register</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {filtered.length} of {students.length} students
            </p>
          </div>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
          <label htmlFor="student-search" className="relative sm:col-span-1">
            <span className="sr-only">Search student records</span>
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              id="student-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search students"
              className={`${controlClass} pl-9`}
            />
          </label>
          <label htmlFor="student-class-filter" className="sr-only">
            Filter by class
          </label>
          <select
            id="student-class-filter"
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setPage(0);
            }}
            className={controlClass}
          >
            <option value="">All classes</option>
            {classNames.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <label htmlFor="student-session-filter" className="sr-only">
            Filter by session
          </label>
          <select
            id="student-session-filter"
            value={sessionFilter}
            onChange={(event) => {
              setSessionFilter(event.target.value);
              setPage(0);
            }}
            className={controlClass}
          >
            <option value="">All sessions</option>
            {sessionNames.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="border-b border-[var(--divider)] bg-[var(--surface-2)] px-5 py-3 text-xs text-[var(--text)]"
        >
          {notice}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={<UsersRound size={20} />}
            title={students.length ? "No matching students" : "No students yet"}
            description={
              students.length
                ? "Change the search or class/session filters."
                : "Import a valid Excel student register above to get started."
            }
          />
        </div>
      ) : (
        <div className="max-h-[42rem] overflow-auto">
          <table className="w-full min-w-[1250px] border-collapse text-[var(--text)]">
            <thead className="sticky top-0 z-10 bg-[var(--surface-2)]">
              <tr>
                {[
                  "Student",
                  "Father",
                  "Mother",
                  "Scholar number",
                  "Admission number",
                  "Date of birth",
                  "Class",
                  "Session",
                  "Certificates",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} scope="col" className={cellClass}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((student) => (
                <tr
                  key={student.id}
                  className="border-t border-[var(--divider)] transition hover:bg-[var(--surface-2)]"
                >
                  <td className={`${cellClass} font-semibold`}>{student.studentName}</td>
                  <td className={cellClass}>{student.fatherName}</td>
                  <td className={cellClass}>{student.motherName}</td>
                  <td className={cellClass}>{student.scholarNumber || "—"}</td>
                  <td className={cellClass}>{student.admissionNo || "—"}</td>
                  <td className={cellClass}>{student.dateOfBirth || "—"}</td>
                  <td className={cellClass}>{student.className || "—"}</td>
                  <td className={cellClass}>{student.session || "—"}</td>
                  <td className={cellClass}>{student.certificateCount}</td>
                  <td className={cellClass}>
                    <div className="flex items-center gap-2">
                      {role !== "approver" && (
                        <button
                          type="button"
                          onClick={() => {
                            setCertificateStudent(student);
                            setCertificate(certificateDefaults());
                            setCertificateFile(null);
                            setCertificateError("");
                            setCertificateWarning("");
                            setDuplicateAcknowledged(false);
                            setDuplicateReason("");
                          }}
                          className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-[var(--primary)] px-2.5 text-[10px] font-semibold text-[var(--on-primary)]"
                        >
                          <FilePlus2 size={13} aria-hidden="true" />
                          Add certificate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setTimelineStudentId(student.id);
                          setTab("timeline");
                        }}
                        className="min-h-8 rounded-md border border-[var(--divider)] px-2.5 text-[10px] font-medium"
                      >
                        History
                      </button>
                      {role !== "approver" && (
                        <button
                          type="button"
                          onClick={() => void openEditor(student)}
                          className="min-h-8 rounded-md border border-[var(--divider)] px-2.5 text-[10px] font-medium"
                        >
                          Edit
                        </button>
                      )}
                      {role === "superadmin" && (
                        <button
                          type="button"
                          onClick={() => void removeStudent(student)}
                          className="min-h-8 rounded-md border border-[var(--divider)] px-2.5 text-[10px] font-medium text-[var(--danger)]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--divider)] px-5 py-3 text-xs">
          <span className="text-[var(--text-muted)]">
            Showing {page * 15 + 1}–{Math.min((page + 1) * 15, filtered.length)} of{" "}
            {filtered.length} students
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => { setPage((value) => value - 1); }}
              className="min-h-8 rounded-md border border-[var(--divider)] px-2.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[var(--text-muted)]">
              Page {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page + 1 >= pageCount}
              onClick={() => { setPage((value) => value + 1); }}
              className="min-h-8 rounded-md border border-[var(--divider)] px-2.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 border-t border-[var(--divider)] bg-[var(--surface-2)] p-4">
        <ShieldCheck
          size={16}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--primary)]"
        />
        <div>
          <p className="text-xs font-semibold text-[var(--text)]">Protected student records</p>
          <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">
            Only authorized administrators can view or manage student information. Changes are
            logged.
          </p>
        </div>
      </div>

      {editing && editForm && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-[var(--scrim)] p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-student-title"
            className="my-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="edit-student-title" className="text-xl font-semibold">
                  Edit student record
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Review details and recorded changes.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close edit student dialog"
                onClick={() => { setEditing(null); }}
                className="rounded-lg p-2 hover:bg-[var(--surface-2)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form
              onSubmit={(event) => void saveStudent(event)}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              {fields.map(({ key, label, required, type }) => (
                <label
                  key={key}
                  htmlFor={`edit-student-${key}`}
                  className="grid gap-1.5 text-sm font-medium"
                >
                  {label}
                  <input
                    id={`edit-student-${key}`}
                    type={type ?? "text"}
                    required={required} aria-required={required}
                    value={editForm[key]}
                    onChange={(event) => {
                      setEditForm((current) =>
                        current ? { ...current, [key]: event.target.value } : current,
                      );
                    }}
                    className={controlClass}
                    />
                </label>
              ))}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => { setEditing(null); }}
                  className="min-h-10 rounded-lg border border-[var(--divider)] px-4 text-sm"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="min-h-10 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
                >
                  Save details
                </button>
              </div>
            </form>
            <div className="mt-5 border-t border-[var(--divider)] pt-4">
              <h3 className="font-semibold">Change history</h3>
              {history.length ? (
                <ul className="mt-2 max-h-36 space-y-2 overflow-auto text-xs text-[var(--text-muted)]">
                  {history.map((item, index) => (
                    <li
                      key={String(item.id ?? index)}
                      className="rounded-lg bg-[var(--surface-2)] p-3"
                    >
                      <strong className="text-[var(--text)]">
                        {String(item.action ?? "Record activity")}
                      </strong>
                      {item.timestamp
                        ? ` · ${new Date(String(item.timestamp)).toLocaleString()}`
                        : ""}
                      {item.actor ? ` · ${String(item.actor)}` : ""}
                      {Array.isArray(item.changedFields) && item.changedFields.length > 0 ? (
                        <p className="mt-1">Changed: {item.changedFields.map(String).join(", ")}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  No change history is available for this record.
                </p>
              )}
            </div>
            {editMessage && (
              <p role="status" className="mt-4 rounded-lg bg-[var(--surface-2)] p-3 text-sm">
                {editMessage}
              </p>
            )}
          </section>
        </div>
      )}

      {certificateStudent && (
        <div
          className="fixed inset-0 z-[130] grid place-items-center overflow-y-auto bg-[var(--scrim)] p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCertificateDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-certificate-title"
            className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                  Student record
                </p>
                <h2 id="add-certificate-title" className="mt-1 text-xl font-semibold">
                  Add certificate
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {certificateStudent.studentName} · Class {certificateStudent.className} · Session{" "}
                  {certificateStudent.session}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close add certificate dialog"
                onClick={closeCertificateDialog}
                className="rounded-lg p-2 hover:bg-[var(--surface-2)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={(event) => void addCertificate(event)} className="mt-5 space-y-4">
              <label
                htmlFor="student-certificate-type"
                className="grid gap-1.5 text-sm font-medium"
              >
                Certificate type
                <select
                  id="student-certificate-type"
                  required aria-required="true"
                  value={certificate.certificateType}
                  onChange={(event) => {
                    setCertificate((current) => ({
                      ...current,
                      certificateType: event.target.value,
                    }));
                  }}
                  className={controlClass}
                >
                  <option value="">Choose a certificate type</option>
                  {typeOptions
                    .filter((option) => option.isActive !== false)
                    .map((option) => (
                      <option key={option.id} value={optionLabel(option)}>
                        {optionLabel(option)}
                      </option>
                    ))}
                </select>
              </label>
              <label
                htmlFor="student-certificate-number"
                className="grid gap-1.5 text-sm font-medium"
              >
                Certificate number
                <input
                  id="student-certificate-number"
                  required aria-required="true"
                  maxLength={80}
                  value={certificate.certificateNumber}
                  onChange={(event) => {
                    setCertificate((current) => ({
                      ...current,
                      certificateNumber: event.target.value,
                    }));
                  }}
                  className={controlClass}
                />
              </label>
              <label
                htmlFor="student-certificate-issued-at"
                className="grid gap-1.5 text-sm font-medium"
              >
                Issue date
                <DatePicker
                  id="student-certificate-issued-at"
                  label="Issue date"
                  required
                  value={certificate.issuedAt}
                  onChange={(value) => {
                    setCertificate((current) => ({
                      ...current,
                      issuedAt: value,
                    }));
                  }}
                  className="mt-1.5"
                />
              </label>
              <label
                htmlFor="student-certificate-file"
                className="grid gap-1.5 text-sm font-medium"
              >
                Certificate document
                <input
                  id="student-certificate-file"
                  type="file"
                  required aria-required="true"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => { setCertificateFile(event.target.files?.[0] ?? null); }}
                  className={controlClass}
                />
                <span className="text-[10px] font-normal text-[var(--text-muted)]">
                  {UPLOAD_LIMITS_HELP}
                </span>
              </label>
              <DuplicateHashWarning
                warning={certificateWarning}
                acknowledged={duplicateAcknowledged}
                reason={duplicateReason}
                setAcknowledged={setDuplicateAcknowledged}
                setReason={setDuplicateReason}
                className="rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4"
              />
              {certificateError && (
                <p
                  role="alert"
                  className="rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--danger)]"
                >
                  {certificateError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCertificateDialog}
                  className="min-h-10 rounded-lg border border-[var(--divider)] px-4 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    uploadingCertificate ||
                    !certificate.certificateType ||
                    !certificate.certificateNumber ||
                    !certificate.issuedAt ||
                    !certificateFile ||
                    (Boolean(certificateWarning) &&
                      (!duplicateAcknowledged || duplicateReason.trim().length < 10))
                  }
                  className="min-h-10 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
                >
                  {uploadingCertificate ? "Uploading…" : "Upload certificate"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
