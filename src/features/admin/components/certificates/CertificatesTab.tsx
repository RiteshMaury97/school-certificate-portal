import { appCheckHeaders } from "@/lib/firebase-client";
import { normalizeAcademicSession } from "@/shared/academic-session";

import { csrf } from "../../utils/admin-helpers";
import DuplicateHashWarning from "../shared/DuplicateHashWarning";

import type { CatalogOption, CertificateHistory, StudentFormState } from "../../types/admin-state.types";
import type { Cert, Role, Student } from "../../types/admin.types";
import type { Dispatch, FormEventHandler, SetStateAction } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(url: string, init?: RequestInit) => Promise<T>;
type Props = {
  role: Role; form: StudentFormState; setForm: Dispatch<SetStateAction<StudentFormState>>;
  sessionOptions: CatalogOption[]; typeOptions: CatalogOption[]; files: File[]; setFiles: Dispatch<SetStateAction<File[]>>;
  duplicateHashWarning: string; duplicateHashAcknowledged: boolean; setDuplicateHashAcknowledged: Dispatch<SetStateAction<boolean>>;
  duplicateHashReason: string; setDuplicateHashReason: Dispatch<SetStateAction<string>>; setDuplicateHashWarning: Dispatch<SetStateAction<string>>;
  busy: boolean; students: Student[]; selectedStudent: string; setSelectedStudent: Dispatch<SetStateAction<string>>;
  uploadMany: FormEventHandler<HTMLFormElement>; certs: Cert[]; certificateHistory: CertificateHistory;
  loadCertificateHistory: (id: string) => Promise<void>; act: (fn: () => Promise<void>) => Promise<void>;
  api: Api; load: () => Promise<void>; setError: Dispatch<SetStateAction<string>>;
};

export default function CertificatesTab(props: Props) {
  const { role, form, setForm, sessionOptions, typeOptions, files, setFiles, duplicateHashWarning,
    duplicateHashAcknowledged, setDuplicateHashAcknowledged, duplicateHashReason, setDuplicateHashReason,
    setDuplicateHashWarning, busy, students, selectedStudent, setSelectedStudent, uploadMany, certs,
    certificateHistory, loadCertificateHistory, act, api, load, setError } = props;
  const selectedStudentRecord = students.find((student) => student.id === selectedStudent);
  const selectedStudentSession = normalizeAcademicSession(selectedStudentRecord?.session ?? "");
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
                  <h2 className="text-lg font-bold">Certificate management</h2>
                  {role !== "approver" && (
                    <form onSubmit={uploadMany} className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        Student
                        <select
                          translate="no"
                          required
                          value={selectedStudent}
                          onChange={(e) => { setSelectedStudent(e.target.value); }}
                          className="mt-1 w-full rounded border p-2.5"
                        >
                          <option value="">Choose student</option>
                          {students.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.studentName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm">
                        Session
                        <select
                          translate="no"
                          required
                          value={selectedStudentSession ?? form.session}
                          disabled={Boolean(selectedStudentSession)}
                          onChange={(e) => { setForm((v) => ({ ...v, session: e.target.value })); }}
                          className="mt-1 w-full rounded border p-2.5"
                        >
                          <option value="">Choose session</option>
                          {selectedStudentSession ? (
                            <option value={selectedStudentSession}>{selectedStudentRecord?.session}</option>
                          ) : sessionOptions.map((option) => {
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
                      <label className="text-sm">
                        Certificate type
                        <select
                          translate="no"
                          required
                          value={form.certificateType}
                          onChange={(e) => { setForm((v) => ({
                              ...v,
                              certificateType: e.target.value,
                            })); }
                          }
                          className="mt-1 w-full rounded border p-2.5"
                        >
                          <option value="">Choose certificate type</option>
                          {typeOptions.map((x) => (
                            <option key={x.id} value={x.name ?? x.label ?? x.id}>
                              {x.name ?? x.label ?? x.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm">
                        Certificate number
                        <input
                          translate="no"
                          required
                          value={form.certificateNumber}
                          onChange={(e) => { setForm((v) => ({
                              ...v,
                              certificateNumber: e.target.value,
                            })); }
                          }
                          className="mt-1 w-full rounded border p-2.5"
                        />
                      </label>
                      <label className="text-sm">
                        Issue date
                        <input
                          translate="no"
                          type="date"
                          required
                          value={form.issuedAt}
                          onChange={(e) => { setForm((v) => ({ ...v, issuedAt: e.target.value })); }}
                          className="mt-1 w-full rounded border p-2.5"
                        />
                      </label>
                      <label className="text-sm">
                        Finished certificate file
                        <input
                          translate="no"
                          type="file"
                          required
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => { setFiles(e.target.files ? Array.from(e.target.files) : []); }}
                          className="mt-1 block w-full"
                        />
                      </label>
                      <DuplicateHashWarning warning={duplicateHashWarning} acknowledged={duplicateHashAcknowledged} reason={duplicateHashReason} setAcknowledged={setDuplicateHashAcknowledged} setReason={setDuplicateHashReason} className="sm:col-span-2 rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4" />
                      <button
                        disabled={
                          busy ||
                          (Boolean(duplicateHashWarning) &&
                            (!duplicateHashAcknowledged || duplicateHashReason.trim().length < 10))
                        } aria-busy={busy}
                        className="rounded-lg bg-[var(--primary)] p-3 text-[var(--on-primary)] sm:col-span-2"
                      >
                        Upload certificate
                      </button>
                    </form>
                  )}
                  <div className="mt-6 space-y-2">
                    {certs.map((c) => (
                      <article
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                      >
                        <span>
                          {c.fileName} · {c.type} · {c.session} ·{" "}
                          <b className="capitalize">{c.status ?? "pending"}</b>
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            Downloads: {c.downloadCount ?? 0}
                            {c.lastDownloadedAt
                              ? ` · Last: ${new Date(c.lastDownloadedAt).toLocaleString()}`
                              : ""}
                          </span>
                        </span>
                        <div className="flex items-center gap-3">
                          {role !== "uploader" && c.status === "pending" && (
                            <button
                              onClick={() => {
                                const number = prompt(
                                  "Enter the new unique certificate number (the existing number is stored only as a hash):",
                                );
                                if (!number) return;
                                const issueDate = prompt("Issue date (YYYY-MM-DD)", c.issueDate);
                                if (issueDate)
                                  act(async () => {
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
                              }}
                              className="text-[var(--text)]"
                            >
                              Edit
                            </button>
                          )}{" "}
                          {role !== "approver" && c.status === "published" && (
                            <label className="cursor-pointer text-[var(--text)]">
                              Replace certificate
                              <input
                                translate="no"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file)
                                    act(async () => {
                                      const certificateNumber = prompt(
                                        "Enter the unique certificate number for the replacement file:",
                                      );
                                      if (!certificateNumber?.trim())
                                        throw new Error("A certificate number is required.");
                                      const f = new FormData();
                                      f.append("file", file);
                                      f.append("session", c.session);
                                      f.append("type", c.type);
                                      f.append("certificateNumber", certificateNumber);
                                      f.append("issueDate", c.issueDate);
                                      f.append(
                                        "confirmDuplicateHash",
                                        String(duplicateHashAcknowledged),
                                      );
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
                              />
                            </label>
                          )}
                          {role !== "uploader" && c.status === "published" && (
                            <button
                              onClick={() => {
                                const reason =
                                  prompt(
                                    "Required internal revocation reason (at least 5 characters):",
                                  ) ?? "";
                                if (reason.trim().length < 5) {
                                  setError("A revocation reason is required.");
                                  return;
                                }
                                if (
                                  confirm(
                                    "Revoke this certificate? It will immediately fail public verification.",
                                  )
                                )
                                  act(async () => {
                                    await api(`/api/admin/certificates/${c.id}/revoke`, {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ reason }),
                                    });
                                    await load();
                                  });
                              }}
                              className="font-semibold text-[var(--text)]"
                            >
                              Revoke
                            </button>
                          )}
                          {c.status === "revoked" && (
                            <span className="font-semibold text-[var(--text)]">Revoked</span>
                          )}
                          {role !== "uploader" && (
                            <button
                              onClick={() => loadCertificateHistory(c.id)}
                              className="text-[var(--text)]"
                            >
                              History
                            </button>
                          )}
                          {role === "superadmin" && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Delete this certificate? The original will be retained in the private soft-delete area for 30 days.",
                                  )
                                )
                                  act(async () => {
                                    await api(`/api/admin/certificates/${c.id}`, {
                                      method: "DELETE",
                                    });
                                    await load();
                                  });
                              }}
                              className="text-[var(--danger)]"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                    {Object.entries(certificateHistory).map(([id, events]) => (
                      <section key={id} className="mt-3 rounded border bg-[var(--surface-2)] p-3">
                        <b className="text-sm">History · {id}</b>
                        <ol className="mt-2 space-y-1 text-xs">
                          {(events).map((event) => (
                            <li key={String(event.id)}>
                              {String(event.action)} · {String(event.actorUid)} ·{" "}
                              {String(event.timestamp ?? "Time unavailable")}
                            </li>
                          ))}
                        </ol>
                      </section>
                    ))}
                  </div>
                </section>
  );
}
