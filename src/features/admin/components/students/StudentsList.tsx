"use client";

import { CalendarDays, FilePlus2, Search, ShieldCheck, UsersRound, X } from "lucide-react";
import { useState } from "react";

import EmptyState from "@/components/feedback/EmptyState";
import { appCheckHeaders } from "@/lib/firebase-client";
import { UPLOAD_LIMITS_HELP_TEXT } from "@/shared/upload-limits";

import { csrf } from "../../utils/admin-helpers";

import type { CatalogOption } from "../../types/admin-state.types";
import type { Role, Student, Tab } from "../../types/admin.types";
import type { Dispatch, SetStateAction, SubmitEvent } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type StudentForm = {
  studentName: string;
  fatherName: string;
  motherName: string;
  className: string;
  scholarNumber: string;
  session: string;
  admissionNumber: string;
  dateOfBirth: string;
  parentEmail: string;
  parentMobile: string;
  notificationConsent: boolean;
};
const emptyForm: StudentForm = {
  studentName: "",
  fatherName: "",
  motherName: "",
  className: "",
  scholarNumber: "",
  session: "",
  admissionNumber: "",
  dateOfBirth: "",
  parentEmail: "",
  parentMobile: "",
  notificationConsent: false,
};
const fieldClass =
  "mt-1.5 min-h-10 w-full rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus)]";

type Props = {
  role: Role;
  visible: Student[];
  filtered: Student[];
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  setTimelineStudentId: Dispatch<SetStateAction<string>>;
  setTab: (tab: Tab) => void;
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  loadStudents: () => Promise<void>;
  removeStudent: (student: Student) => Promise<void>;
  typeOptions: CatalogOption[];
  classOptions: CatalogOption[];
};

export default function StudentsList(props: Props) {
  const {
    role,
    visible,
    filtered,
    search,
    setSearch,
    page,
    setPage,
    setTimelineStudentId,
    setTab,
    act,
    api,
    loadStudents,
    removeStudent,
    typeOptions,
    classOptions,
  } = props;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const canEdit = role !== "approver";
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [certificatePanel, setCertificatePanel] = useState(false);
  const [certificateType, setCertificateType] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [certificateDate, setCertificateDate] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [savingStudent, setSavingStudent] = useState(false);

  function openEditor(student: Student, addCertificate = false) {
    setEditing(student);
    setForm({
      studentName: student.studentName ?? "",
      fatherName: student.fatherName ?? "",
      motherName: student.motherName ?? "",
      className: student.className ?? "",
      scholarNumber: student.scholarNumber ?? "",
      session: student.session ?? "",
      admissionNumber: student.admissionNo ?? "",
      dateOfBirth: student.dateOfBirth ?? "",
      parentEmail: student.parentEmail ?? "",
      parentMobile: student.parentMobile ?? "",
      notificationConsent: student.notificationConsent === true,
    });
    setCertificatePanel(addCertificate);
    setCertificateType("");
    setCertificateNumber("");
    setCertificateDate("");
    setCertificateFile(null);
    setDialogError("");
    setSavedMessage("");
  }

  async function saveStudent(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setDialogError("");
    setSavedMessage("");
    setSavingStudent(true);
    try {
      await api(`/api/admin/students/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      await loadStudents();
      setSavedMessage("Student details saved. The edited fields were added to the audit log.");
    } catch (error) {
      setDialogError(
        error instanceof Error ? error.message : "Student details could not be saved.",
      );
    } finally {
      setSavingStudent(false);
    }
  }

  async function addCertificate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !certificateFile) return;
    setDialogError("");
    setSavedMessage("");
    const payload = new FormData();
    payload.set("studentId", editing.id);
    payload.set("session", form.session);
    payload.set("certificateType", certificateType);
    payload.set("certificateNumber", certificateNumber);
    payload.set("issuedAt", certificateDate);
    payload.set("file", certificateFile);
    try {
      const response = await fetch("/api/admin/certificates", {
        method: "POST",
        body: payload,
        headers: { "x-csrf-token": decodeURIComponent(csrf()), ...(await appCheckHeaders()) },
        credentials: "same-origin",
        cache: "no-store",
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data === "object" && data !== null && "error" in data
            ? String(data.error)
            : "Certificate could not be added.";
        throw new Error(message);
      }
      await loadStudents();
      setCertificateType("");
      setCertificateNumber("");
      setCertificateDate("");
      setCertificateFile(null);
      setEditing((current) =>
        current ? { ...current, certificateCount: current.certificateCount + 1 } : current,
      );
      setSavedMessage("Certificate added to this student.");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Certificate could not be added.");
    }
  }

  function change<K extends keyof StudentForm>(key: K, value: StudentForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]">
              <UsersRound size={18} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text)]">Student directory</h1>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {filtered.length} {filtered.length === 1 ? "record" : "records"}
              </p>
            </div>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">
              Search by name, scholar number, class or admission number
            </span>
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              translate="no"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Name, class, scholar no. or admission no."
              className="min-h-10 w-full rounded-lg border border-[var(--divider)] bg-[var(--surface)] pl-9 pr-3 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-[var(--divider)] py-3 text-[10px] text-[var(--text-muted)]">
          <span>All sessions</span>
          <span>Student records are private to authorized administrators</span>
        </div>
        <div className="mt-4 space-y-3">
          {visible.length === 0 && (
            <EmptyState
              icon={<UsersRound size={20} />}
              title={search ? "No matching students" : "No students yet"}
              description={
                search
                  ? "Try a different name or admission number."
                  : "Add student records from the Add / Import Students page."
              }
              action={
                !search && canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTab("studentIntake");
                    }}
                    className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]"
                  >
                    Add first student
                  </button>
                ) : undefined
              }
            />
          )}
          {visible.map((student) => (
            <article
              key={student.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--divider)] p-3 transition hover:bg-[var(--surface-2)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text)]">
                  {student.studentName}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Parents: {student.fatherName} / {student.motherName}{" "}
                  <span className="px-1">·</span> Class {student.className || "Needs update"}{" "}
                  <span className="px-1">·</span> {student.session}
                </p>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  Scholar no. {student.scholarNumber || "Needs update"} ·{" "}
                  {student.admissionNo ? `Admission no. ${student.admissionNo} · ` : ""}
                  {student.certificateCount} certificates
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTimelineStudentId(student.id);
                    setTab("timeline");
                  }}
                  className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium text-[var(--text)]"
                >
                  Timeline
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      openEditor(student, true);
                    }}
                    className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium text-[var(--text)]"
                  >
                    Add certificate
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      openEditor(student);
                    }}
                    className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium text-[var(--text)]"
                  >
                    Edit details
                  </button>
                )}
                {role === "superadmin" && (
                  <button
                    type="button"
                    onClick={() => void removeStudent(student)}
                    className="min-h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--danger)]"
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--divider)] pt-3 text-xs">
          <span className="text-[var(--text-muted)]">
            Showing {filtered.length === 0 ? 0 : page * 10 + 1}–
            {Math.min((page + 1) * 10, filtered.length)} of {filtered.length} students
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => {
                setPage((value) => value - 1);
              }}
              className="min-h-8 rounded-md border border-[var(--divider)] px-2.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[var(--text-muted)]">
              Page {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              disabled={(page + 1) * 10 >= filtered.length}
              onClick={() => {
                setPage((value) => value + 1);
              }}
              className="min-h-8 rounded-md border border-[var(--divider)] px-2.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-lg bg-[var(--surface-2)] p-3">
          <ShieldCheck
            size={16}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--primary)]"
          />
          <div>
            <p className="text-xs font-semibold text-[var(--text)]">Protected student records</p>
            <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">
              Only authorized administrators can view or manage student information. Changes are
              recorded in the audit log.
            </p>
          </div>
        </div>
      </section>

      {editing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--scrim)] p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-edit-title"
            className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-2xl"
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--divider)] bg-[var(--surface)] px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                  Student record
                </p>
                <h2 id="student-edit-title" className="mt-1 text-lg font-bold text-[var(--text)]">
                  Edit all student details
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Changes are recorded by field in the audit log.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                }}
                aria-label="Close student details"
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--divider)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              >
                <X size={17} />
              </button>
            </header>
            <div className="space-y-5 p-5 sm:p-6">
              <form onSubmit={saveStudent} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["studentName", "Student name", "text"],
                      ["fatherName", "Father name", "text"],
                      ["motherName", "Mother name", "text"],
                      ["className", "Class / section", "text"],
                      ["scholarNumber", "Scholar number", "text"],
                      ["session", "Academic session", "text"],
                      ["admissionNumber", "Admission number", "text"],
                      ["dateOfBirth", "Date of birth", "date"],
                      ["parentEmail", "Parent email", "email"],
                      ["parentMobile", "Parent mobile", "tel"],
                    ] as const
                  ).map(([key, label, type]) => (
                    <label key={key} className="text-xs font-semibold text-[var(--text-muted)]">
                      {label}
                      {key === "className" ? (
                        <select
                          required
                          value={form.className}
                          onChange={(event) => {
                            change("className", event.target.value);
                          }}
                          className={fieldClass}
                        >
                          <option value="">Choose class</option>
                          {form.className &&
                            !classOptions.some(
                              (item) => (item.label ?? item.name ?? item.id) === form.className,
                            ) && <option value={form.className}>{form.className} (current)</option>}
                          {classOptions.map((item) => (
                            <option key={item.id} value={item.label ?? item.name ?? item.id}>
                              {item.label ?? item.name ?? item.id}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          translate="no"
                          type={type}
                          maxLength={
                            key === "studentName" || key === "fatherName" || key === "motherName"
                              ? 100
                              : 254
                          }
                          value={form[key]}
                          onChange={(event) => {
                            change(key, event.target.value);
                          }}
                          className={fieldClass}
                        />
                      )}
                    </label>
                  ))}
                </div>
                <label className="flex items-start gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--text-muted)]">
                  <input
                    translate="no"
                    type="checkbox"
                    checked={form.notificationConsent}
                    onChange={(event) => {
                      change("notificationConsent", event.target.checked);
                    }}
                    className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                  />
                  Parent/guardian has consented to receive certificate availability notifications at
                  the contact details above.
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                    }}
                    className="min-h-10 rounded-lg border border-[var(--divider)] px-4 text-sm font-medium text-[var(--text)]"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={savingStudent}
                    className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
                  >
                    {savingStudent ? "Saving…" : "Save details"}
                  </button>
                </div>
              </form>

              <section className="overflow-hidden rounded-xl border border-[var(--divider)]">
                <button
                  type="button"
                  onClick={() => {
                    setCertificatePanel((value) => !value);
                  }}
                  aria-expanded={certificatePanel}
                  className="flex min-h-12 w-full items-center justify-between gap-2 bg-[var(--surface-2)] px-4 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <FilePlus2 size={16} className="text-[var(--primary)]" />
                    Add another certificate
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {editing.certificateCount} already attached
                  </span>
                </button>
                {certificatePanel && (
                  <form onSubmit={addCertificate} className="grid gap-3 p-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-[var(--text-muted)]">
                      Certificate name
                      <select
                        required
                        value={certificateType}
                        onChange={(event) => {
                          setCertificateType(event.target.value);
                        }}
                        className={fieldClass}
                      >
                        <option value="">Choose certificate type</option>
                        {typeOptions.map((item) => (
                          <option key={item.id} value={item.name ?? item.label ?? item.id}>
                            {item.name ?? item.label ?? item.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-[var(--text-muted)]">
                      Certificate number
                      <input
                        required
                        maxLength={80}
                        value={certificateNumber}
                        onChange={(event) => {
                          setCertificateNumber(event.target.value);
                        }}
                        className={fieldClass}
                      />
                    </label>
                    <label className="text-xs font-semibold text-[var(--text-muted)]">
                      Issue date
                      <input
                        required
                        type="date"
                        value={certificateDate}
                        onChange={(event) => {
                          setCertificateDate(event.target.value);
                        }}
                        className={fieldClass}
                      />
                    </label>
                    <label className="text-xs font-semibold text-[var(--text-muted)]">
                      Certificate file ({UPLOAD_LIMITS_HELP_TEXT})
                      <input
                        required
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(event) => {
                          setCertificateFile(event.target.files?.[0] ?? null);
                        }}
                        className={`${fieldClass} file:mr-3 file:rounded file:border-0 file:bg-[var(--surface-2)] file:px-2 file:py-1`}
                      />
                    </label>
                    {typeOptions.length === 0 && (
                      <p className="text-xs text-[var(--danger)] sm:col-span-2">
                        Add a certificate type in School Catalog before uploading.
                      </p>
                    )}
                    <button
                      disabled={!typeOptions.length}
                      className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50 sm:col-span-2"
                    >
                      Add certificate to {editing.studentName}
                    </button>
                  </form>
                )}
              </section>
              {dialogError && (
                <p
                  role="alert"
                  className="rounded-lg bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]"
                >
                  {dialogError}
                </p>
              )}
              {savedMessage && (
                <p
                  role="status"
                  className="rounded-lg bg-[var(--success)]/10 p-3 text-sm text-[var(--success)]"
                >
                  {savedMessage}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
