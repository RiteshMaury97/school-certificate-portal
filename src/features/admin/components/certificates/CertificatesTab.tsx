import { BadgeCheck, Clock3, FileText, ShieldCheck, Upload, UserRound } from "lucide-react";

import { DatePicker } from "@/components/ui/DatePicker";
import { appCheckHeaders } from "@/lib/firebase-client";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { confirmAction, requestInput } from "@/shared/admin-dialogs";
import { readText } from "@/shared/safe-values";
import {
  MAX_BULK_FILES,
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  UPLOAD_LIMITS_HELP,
  UPLOAD_MAX_BYTES,
} from "@/shared/upload-limits";

import { csrf } from "../../utils/admin-helpers";
import DuplicateHashWarning from "../shared/DuplicateHashWarning";

import type {
  CatalogOption,
  CertificateHistory,
  StudentFormState,
} from "../../types/admin-state.types";
import type { Cert, Role, Student } from "../../types/admin.types";
import type { Dispatch, SubmitEventHandler, SetStateAction } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type Props = {
  role: Role;
  form: StudentFormState;
  setForm: Dispatch<SetStateAction<StudentFormState>>;
  sessionOptions: CatalogOption[];
  typeOptions: CatalogOption[];
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
  duplicateHashWarning: string;
  duplicateHashAcknowledged: boolean;
  setDuplicateHashAcknowledged: Dispatch<SetStateAction<boolean>>;
  duplicateHashReason: string;
  setDuplicateHashReason: Dispatch<SetStateAction<string>>;
  setDuplicateHashWarning: Dispatch<SetStateAction<string>>;
  busy: boolean;
  students: Student[];
  selectedStudent: string;
  setSelectedStudent: Dispatch<SetStateAction<string>>;
  uploadMany: SubmitEventHandler<HTMLFormElement>;
  certs: Cert[];
  certificateHistory: CertificateHistory;
  loadCertificateHistory: (id: string) => Promise<void>;
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
  setError: Dispatch<SetStateAction<string>>;
};

export default function CertificatesTab(props: Props) {
  const {
    role,
    form,
    setForm,
    sessionOptions,
    typeOptions,
    files,
    setFiles,
    duplicateHashWarning,
    duplicateHashAcknowledged,
    setDuplicateHashAcknowledged,
    duplicateHashReason,
    setDuplicateHashReason,
    setDuplicateHashWarning,
    busy,
    students,
    selectedStudent,
    setSelectedStudent,
    uploadMany,
    certs,
    certificateHistory,
    loadCertificateHistory,
    act,
    api,
    load,
    setError,
  } = props;
  const selectedStudentRecord = students.find((student) => student.id === selectedStudent);
  const selectedStudentSession = normalizeAcademicSession(selectedStudentRecord?.session ?? "");
  const publishedCount = certs.filter((certificate) => certificate.status === "published").length;
  const pendingCount = certs.filter((certificate) => certificate.status === "pending").length;
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl bg-[var(--primary)] p-6 text-[var(--on-primary)] shadow-[var(--shadow-card)] sm:p-8">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[32px] border-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-[var(--accent)]">
              <FileText size={23} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
                Records workspace
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Certificate management
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">
                Add finished certificates to student records, track publication status, and manage
                replacements.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center">
              <b className="block text-xl">{certs.length}</b>
              <small className="text-[10px] opacity-80">Total files</small>
            </span>
            <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center">
              <b className="block text-xl">{publishedCount}</b>
              <small className="text-[10px] opacity-80">Published</small>
            </span>
          </div>
        </div>
      </header>
      {role !== "approver" && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <form
            onSubmit={uploadMany}
            className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
          >
            <div className="border-b border-[var(--divider)] px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
                  <Upload size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-bold">Upload a certificate</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    Attach one finished file to a student record.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
              <p className="rounded-xl bg-[var(--surface-2)] px-4 py-3 text-xs leading-5 text-[var(--text-muted)] sm:col-span-2">
                {UPLOAD_LIMITS_HELP} Mapped bulk intake accepts a CSV up to{" "}
                {Math.round(MAX_CSV_BYTES / (1024 * 1024))} MB, {MAX_CSV_ROWS} mapping rows, and{" "}
                {MAX_BULK_FILES} files up to {Math.round(UPLOAD_MAX_BYTES / (1024 * 1024))} MB each.
              </p>
              <label
                htmlFor="certificate-student"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Student
                <select
                  id="certificate-student"
                  aria-label="Student"
                  translate="no"
                  required
                  aria-required="true"
                  value={selectedStudent}
                  onChange={(e) => {
                    setSelectedStudent(e.target.value);
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 text-sm"
                >
                  <option value="">Choose student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.studentName}
                    </option>
                  ))}
                </select>
              </label>
              <label
                htmlFor="certificate-session"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Session
                <select
                  id="certificate-session"
                  aria-label="Session"
                  translate="no"
                  required
                  aria-required="true"
                  value={selectedStudentSession ?? form.session}
                  disabled={Boolean(selectedStudentSession)}
                  onChange={(e) => {
                    setForm((v) => ({ ...v, session: e.target.value }));
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 text-sm"
                >
                  <option value="">Choose session</option>
                  {selectedStudentSession ? (
                    <option value={selectedStudentSession}>{selectedStudentRecord?.session}</option>
                  ) : (
                    sessionOptions.map((option) => {
                      const value =
                        normalizeAcademicSession(option.label ?? "") ??
                        normalizeAcademicSession(option.name ?? "") ??
                        normalizeAcademicSession(option.id);
                      return value ? (
                        <option key={option.id} value={value}>
                          {option.label ?? option.name ?? option.id}
                        </option>
                      ) : null;
                    })
                  )}
                </select>
              </label>
              <label
                htmlFor="certificate-type"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Certificate type
                <select
                  id="certificate-type"
                  aria-label="Certificate type"
                  translate="no"
                  required
                  aria-required="true"
                  value={form.certificateType}
                  onChange={(e) => {
                    setForm((v) => ({
                      ...v,
                      certificateType: e.target.value,
                    }));
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 text-sm"
                >
                  <option value="">Choose certificate type</option>
                  {typeOptions.map((x) => (
                    <option key={x.id} value={x.name ?? x.label ?? x.id}>
                      {x.name ?? x.label ?? x.id}
                    </option>
                  ))}
                </select>
              </label>
              <label
                htmlFor="certificate-number"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Certificate number
                <input
                  id="certificate-number"
                  aria-label="Certificate number"
                  translate="no"
                  required
                  aria-required="true"
                  value={form.certificateNumber}
                  onChange={(e) => {
                    setForm((v) => ({
                      ...v,
                      certificateNumber: e.target.value,
                    }));
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 text-sm"
                />
              </label>
              <label
                htmlFor="certificate-issue-date"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Issue date
                <DatePicker
                  id="certificate-issue-date"
                  label="Issue date"
                  required
                  value={form.issuedAt}
                  onChange={(value) => {
                    setForm((v) => ({ ...v, issuedAt: value }));
                  }}
                  className="mt-2"
                />
              </label>
              <label
                htmlFor="certificate-file"
                className="text-sm font-semibold text-[var(--text)] sm:col-span-2"
              >
                Finished certificate file
                <input
                  id="certificate-file"
                  aria-label="Finished certificate file"
                  translate="no"
                  type="file"
                  required
                  aria-required="true"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    setFiles(e.target.files ? Array.from(e.target.files) : []);
                  }}
                  className="mt-2 block min-h-12 w-full cursor-pointer rounded-xl border border-dashed border-[var(--primary)] bg-[var(--surface-2)] p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-2 file:font-semibold file:text-[var(--on-primary)]"
                />
                {files.length > 0 && (
                  <span className="mt-2 block text-xs text-[var(--primary)]">
                    Selected: {files.map((file) => file.name).join(", ")}
                  </span>
                )}
              </label>
              <DuplicateHashWarning
                warning={duplicateHashWarning}
                acknowledged={duplicateHashAcknowledged}
                reason={duplicateHashReason}
                setAcknowledged={setDuplicateHashAcknowledged}
                setReason={setDuplicateHashReason}
                className="sm:col-span-2 rounded-xl border border-[var(--warning)]/30 bg-[var(--surface-2)] p-4"
              />
              <button
                disabled={
                  busy ||
                  (Boolean(duplicateHashWarning) &&
                    (!duplicateHashAcknowledged || duplicateHashReason.trim().length < 10))
                }
                aria-busy={busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] p-3 font-semibold text-[var(--on-primary)] shadow-md transition hover:brightness-105 disabled:opacity-60 sm:col-span-2"
              >
                <Upload size={17} aria-hidden="true" /> Upload certificate
              </button>
            </div>
          </form>
          <aside className="space-y-4 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-[var(--primary)]" aria-hidden="true" />
              <h3 className="font-bold">Upload requirements</h3>
            </div>
            <p className="text-xs leading-5 text-[var(--text-muted)]">{UPLOAD_LIMITS_HELP}</p>
            <div className="space-y-2 rounded-xl bg-[var(--surface-2)] p-3 text-xs">
              <p className="flex items-center justify-between gap-2">
                <span>Per file</span>
                <b>{Math.round(UPLOAD_MAX_BYTES / (1024 * 1024))} MB max</b>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>PDF pages</span>
                <b>Up to 10</b>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Bulk CSV</span>
                <b>
                  {Math.round(MAX_CSV_BYTES / (1024 * 1024))} MB · {MAX_CSV_ROWS} rows
                </b>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>Mapped files</span>
                <b>{MAX_BULK_FILES} max</b>
              </p>
            </div>
            <div className="space-y-3 border-t border-[var(--divider)] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Quick steps
              </p>
              <p className="flex items-start gap-2 text-xs leading-5">
                <UserRound size={15} className="mt-0.5 text-[var(--primary)]" aria-hidden="true" />{" "}
                Select the student and confirm the academic session.
              </p>
              <p className="flex items-start gap-2 text-xs leading-5">
                <FileText size={15} className="mt-0.5 text-[var(--primary)]" aria-hidden="true" />{" "}
                Add certificate details and choose the final PDF or image.
              </p>
              <p className="flex items-start gap-2 text-xs leading-5">
                <BadgeCheck size={15} className="mt-0.5 text-[var(--primary)]" aria-hidden="true" />{" "}
                Review and publish it through the approval workflow.
              </p>
            </div>
          </aside>
        </div>
      )}
      <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--divider)] px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-bold">Certificate records</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Review publication, downloads, replacements, and history.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 font-semibold">
              {pendingCount} pending
            </span>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-3 py-1.5 font-semibold text-[var(--success)]">
              {publishedCount} published
            </span>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          {certs.map((c) => (
            <article
              key={c.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 text-sm transition hover:border-[var(--primary)]/35 hover:shadow-sm lg:flex-row lg:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--text)]">{c.fileName}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {c.type} <span className="px-1">·</span> {c.session}
                  <span className="px-1">·</span> Certificate{" "}
                  {c.certificateNumber?.length ? c.certificateNumber : "number protected"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                  <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-semibold capitalize text-[var(--text)]">
                    {c.status ?? "pending"}
                  </span>
                  <span>{c.downloadCount ?? 0} downloads</span>
                  {c.lastDownloadedAt && (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={12} aria-hidden="true" /> Last{" "}
                      {new Date(c.lastDownloadedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {role !== "uploader" && c.status === "pending" && (
                  <button
                    onClick={() => {
                      void (async () => {
                        const number = await requestInput({
                          title: "Edit certificate number",
                          description: "The existing number is stored only as a hash.",
                          label: "New unique certificate number",
                          required: true,
                        });
                        if (!number) return;
                        const issueDate = await requestInput({
                          title: "Certificate issue date",
                          description: "Enter the recorded issue date.",
                          label: "Issue date",
                          type: "date",
                          initialValue: c.issueDate,
                          required: true,
                        });
                        if (issueDate)
                          void act(async () => {
                            await api(`/api/admin/certificates/${c.id}`, {
                              method: "PATCH",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                type: c.type,
                                certificateNumber: number,
                                session: c.session,
                                issueDate,
                              }),
                            });
                            await load();
                          });
                      })();
                    }}
                    className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
                  >
                    Edit
                  </button>
                )}{" "}
                {role !== "approver" && c.status === "published" && (
                  <label
                    htmlFor={`replace-certificate-${c.id}`}
                    className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-[var(--divider)] px-3 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
                  >
                    Replace certificate
                    <input
                      id={`replace-certificate-${c.id}`}
                      aria-label={`Replace certificate ${c.fileName}`}
                      translate="no"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          void act(async () => {
                            const certificateNumber = await requestInput({
                              title: "Replace certificate",
                              description:
                                "Enter the unique number to associate with this replacement file.",
                              label: "Certificate number",
                              required: true,
                            });
                            if (!certificateNumber?.trim())
                              throw new Error("A certificate number is required.");
                            const f = new FormData();
                            f.append("file", file);
                            f.append("session", c.session);
                            f.append("type", c.type);
                            f.append("certificateNumber", certificateNumber);
                            f.append("issueDate", c.issueDate);
                            f.append("confirmDuplicateHash", String(duplicateHashAcknowledged));
                            f.append("duplicateHashReason", duplicateHashReason);
                            const response = await fetch(`/api/admin/certificates/${c.id}`, {
                              method: "PUT",
                              body: f,
                              headers: {
                                "x-csrf-token": decodeURIComponent(csrf()),
                                ...(await appCheckHeaders()),
                              },
                            });
                            if (!response.ok) {
                              const data = await response.json().catch(() => ({}));
                              if (data.duplicateFileWarning === true)
                                setDuplicateHashWarning(
                                  String(data.error ?? "Duplicate file detected."),
                                );
                              throw new Error(String(data.error ?? "Replacement failed."));
                            }
                            setDuplicateHashWarning("");
                            setDuplicateHashAcknowledged(false);
                            setDuplicateHashReason("");
                            await load();
                          });
                      }}
                      required
                      aria-required="true"
                    />
                  </label>
                )}
                {role !== "uploader" && c.status === "published" && (
                  <button
                    onClick={() => {
                      void (async () => {
                        const reason = await requestInput({
                          title: "Revoke certificate",
                          description: "Record why this certificate must be revoked.",
                          label: "Internal reason",
                          required: true,
                          minLength: 5,
                        });
                        if (reason === null) return;
                        if (reason.trim().length < 5) {
                          setError("A revocation reason is required.");
                          return;
                        }
                        if (
                          await confirmAction(
                            "Revoke certificate",
                            "It will immediately fail public verification.",
                            "Revoke certificate",
                          )
                        )
                          void act(async () => {
                            await api(`/api/admin/certificates/${c.id}/revoke`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({ reason }),
                            });
                            await load();
                          });
                      })();
                    }}
                    className="min-h-9 rounded-lg border border-[var(--warning)]/30 px-3 text-xs font-semibold text-[var(--warning)] hover:bg-[var(--surface-2)]"
                  >
                    Revoke
                  </button>
                )}
                {c.status === "revoked" && (
                  <span className="font-semibold text-[var(--text)]">Revoked</span>
                )}
                {role !== "uploader" && (
                  <button
                    onClick={() => {
                      void loadCertificateHistory(c.id);
                    }}
                    className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
                  >
                    History
                  </button>
                )}
                {role === "superadmin" && (
                  <button
                    onClick={() => {
                      void confirmAction(
                        "Delete certificate",
                        "The original will be retained in the private soft-delete area for 30 days.",
                        "Delete certificate",
                      ).then((accepted) => {
                        if (accepted)
                          void act(async () => {
                            await api(`/api/admin/certificates/${c.id}`, {
                              method: "DELETE",
                            });
                            await load();
                          });
                      });
                    }}
                    className="min-h-9 rounded-lg px-3 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--surface-2)]"
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))}
          {Object.entries(certificateHistory).map(([id, events]) => (
            <section
              key={id}
              className="mt-3 rounded-xl border border-[var(--divider)] bg-[var(--surface-2)] p-4"
            >
              <b className="text-sm">History · {id}</b>
              <ol className="mt-2 space-y-1 text-xs">
                {events.map((event) => (
                  <li key={String(event.id)}>
                    {String(event.action)} · {String(event.actorUid)} ·{" "}
                    {readText(event.timestamp, "Time unavailable")}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
