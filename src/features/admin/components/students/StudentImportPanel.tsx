"use client";

import { Download, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";
import { MAX_CSV_ROWS, UPLOAD_LIMITS_HELP_TEXT } from "@/shared/upload-limits";

import { csrf } from "../../utils/admin-helpers";

import type { CatalogOption, StudentFormState } from "../../types/admin-state.types";

type ImportRow = {
  row: number;
  data: Record<string, unknown> | null;
  error: string | null;
  fieldErrors?: { field: string; message: string }[];
  studentId?: string;
};
type Preview = {
  total: number;
  valid: number;
  errors?: ImportRow[];
  preview?: ImportRow[];
  ok?: boolean;
  created?: number;
  updated?: number;
};
type Props = {
  busy: boolean;
  act: (fn: () => Promise<void>) => Promise<void>;
  loadStudents: () => Promise<void>;
  classOptions: CatalogOption[];
  sessionOptions: CatalogOption[];
  typeOptions: CatalogOption[];
};
const fieldNames = [
  "scholarNumber",
  "className",
  "admissionNumber",
  "dateOfBirth",
  "studentName",
  "fatherName",
  "motherName",
  "session",
];
const inputClass =
  "min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]";

export default function StudentImportPanel({
  busy,
  act,
  loadStudents,
  classOptions,
  sessionOptions,
  typeOptions,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [page, setPage] = useState(0);
  const [certificateRow, setCertificateRow] = useState<ImportRow | null>(null);
  const [certificateType, setCertificateType] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [certificateError, setCertificateError] = useState("");
  const rows = preview?.preview ?? preview?.errors ?? [];
  const validReady = Boolean(
    preview &&
    preview.total > 0 &&
    preview.valid === preview.total &&
    rows.length === preview.total,
  );
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const visibleRows = useMemo(() => rows.slice(page * 25, page * 25 + 25), [rows, page]);

  async function send(action: "preview" | "commit") {
    if (!file) return;
    await act(async () => {
      const body = new FormData();
      body.set("file", file);
      body.set("action", action);
      const response = await fetch("/api/admin/students/import", {
        method: "POST",
        body,
        headers: { "x-csrf-token": decodeURIComponent(csrf()), ...(await appCheckHeaders()) },
      });
      const data = (await response.json()) as Preview & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Student import failed.");
      setPreview(
        action === "commit" ? { ...data, preview: data.preview ?? preview?.preview ?? [] } : data,
      );
      setPage(0);
      if (action === "commit") await loadStudents();
    });
  }
  async function download() {
    await act(async () => {
      const response = await fetch("/api/admin/templates?format=xlsx", {
        headers: await appCheckHeaders(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Excel template download failed.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "student-import-template.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }
  async function uploadCertificate(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!certificateRow?.studentId || !certificateFile) return;
    setCertificateError("");
    setMessage("");
    const body = new FormData();
    body.set("studentId", certificateRow.studentId);
    body.set("session", String(certificateRow.data?.session ?? ""));
    body.set("certificateType", certificateType);
    body.set("certificateNumber", certificateNumber);
    body.set("issuedAt", issueDate);
    body.set("file", certificateFile);
    body.set("confirmDuplicateHash", "false");
    const response = await fetch("/api/admin/certificates", {
      method: "POST",
      body,
      headers: { "x-csrf-token": decodeURIComponent(csrf()), ...(await appCheckHeaders()) },
      credentials: "same-origin",
      cache: "no-store",
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setCertificateError(result.error ?? "Certificate upload failed.");
      return;
    }
    setMessage(
      "Certificate uploaded for review. You can add another certificate for this student.",
    );
    setCertificateNumber("");
    setIssueDate("");
    setCertificateFile(null);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--primary)]">
              Student records
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text)]">
              Import students from Excel
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Review every spreadsheet row before saving. Class and session values must exactly
              match the active School Catalog entries.
            </p>
          </div>
          <span className="hidden rounded-xl bg-[var(--surface-2)] p-3 text-[var(--primary)] sm:block">
            <FileSpreadsheet />
          </span>
        </div>
        <div className="mt-5 grid gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface-2)] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">
              Start with the official workbook
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              It includes a sample row, field rules, class and session dropdowns, and the current
              allowed values.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void download()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)]"
          >
            <Download size={15} /> Download Excel demo
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          CSV up to 2 MB; workbook up to 4 MB; up to {MAX_CSV_ROWS} student rows.{" "}
          {UPLOAD_LIMITS_HELP_TEXT}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--text-muted)]">
            <Upload size={17} />
            <span className="min-w-0 flex-1 truncate">
              {file?.name ?? "Choose an .xlsx workbook (up to 4 MB)"}
            </span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            disabled={!file || busy}
            onClick={() => void send("preview")}
            className="min-h-12 rounded-xl border border-[var(--divider)] px-5 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
          >
            Preview &amp; validate
          </button>
          <button
            type="button"
            disabled={!validReady || busy || preview?.ok === true}
            onClick={() => void send("commit")}
            className="min-h-12 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
          >
            {preview?.ok ? "Import complete" : "Import valid rows"}
          </button>
        </div>
        {preview && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface-2)] p-3 text-sm">
            <span>{preview.total} rows</span>
            <span className="text-[var(--success)]">{preview.valid} valid</span>
            <span
              className={
                preview.valid === preview.total ? "text-[var(--success)]" : "text-[var(--danger)]"
              }
            >
              {preview.total - preview.valid} need correction
            </span>
            {preview.ok && (
              <span className="font-semibold text-[var(--success)]">
                Student records saved. Add certificates from each row below.
              </span>
            )}
          </div>
        )}
      </section>
      {preview && (
        <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--divider)] p-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-[var(--text)]">Spreadsheet review</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Errors show the spreadsheet row and the field that needs correction. Correct the
                workbook and preview it again.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <button
                disabled={page === 0}
                onClick={() => {
                  setPage((n) => n - 1);
                }}
                className="rounded border border-[var(--divider)] px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page + 1} of {pages}
              </span>
              <button
                disabled={page + 1 >= pages}
                onClick={() => {
                  setPage((n) => n + 1);
                }}
                className="rounded border border-[var(--divider)] px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1150px] w-full text-left text-xs">
              <thead className="bg-[var(--surface-2)] text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Excel row</th>
                  {fieldNames.map((field) => (
                    <th key={field} className="p-3">
                      {field}
                    </th>
                  ))}
                  <th className="p-3">Validation</th>
                  <th className="p-3">Certificates</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.row} className="border-t border-[var(--divider)] align-top">
                    <td className="p-3 font-semibold">{row.row}</td>
                    {fieldNames.map((field) => {
                      const issue = row.fieldErrors?.find(
                        (entry) =>
                          entry.field.toLowerCase().replace(/\s/g, "") === field.toLowerCase(),
                      );
                      return (
                        <td
                          key={field}
                          title={issue?.message}
                          className={`max-w-52 whitespace-normal p-3 ${issue ? "bg-[var(--danger)]/10 text-[var(--danger)] ring-1 ring-inset ring-[var(--danger)]" : "text-[var(--text)]"}`}
                        >
                          {String(row.data?.[field] ?? "—")}
                          {issue && <span className="mt-1 block">{issue.message}</span>}
                        </td>
                      );
                    })}
                    <td className="max-w-64 p-3">
                      {row.error ? (
                        <span className="text-[var(--danger)]">{row.error}</span>
                      ) : (
                        <span className="text-[var(--success)]">
                          {preview.ok ? "Imported" : "Ready"}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {preview.ok && row.studentId ? (
                        <button
                          onClick={() => {
                            setCertificateRow(row);
                            setMessage("");
                            setCertificateError("");
                          }}
                          className="rounded-lg border border-[var(--divider)] px-3 py-2 font-semibold text-[var(--primary)]"
                        >
                          Add certificate
                        </button>
                      ) : (
                        <span className="text-[var(--text-muted)]">Import first</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[var(--divider)] px-4 py-3 text-xs text-[var(--text-muted)]">
            Showing {rows.length ? page * 25 + 1 : 0}–{Math.min(rows.length, (page + 1) * 25)} of{" "}
            {rows.length} spreadsheet rows. {classOptions.length} active classes ·{" "}
            {sessionOptions.length} active sessions.
          </div>
          <div className="flex items-start gap-2 border-t border-[var(--divider)] bg-[var(--surface-2)] p-4 text-xs leading-5 text-[var(--text-muted)]">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" />
            Certificate upload is enabled only after a fully valid import. Files are checked and
            sent for the configured certificate review workflow.
          </div>
        </section>
      )}
      {certificateRow && (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCertificateRow(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="certificate-dialog-title"
            className="w-full max-w-lg rounded-2xl bg-[var(--surface)] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="certificate-dialog-title" className="text-lg font-semibold">
                  Add certificate
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {String(certificateRow.data?.studentName ?? "Student")} ·{" "}
                  {String(certificateRow.data?.className ?? "")} ·{" "}
                  {String(certificateRow.data?.scholarNumber ?? "")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCertificateRow(null);
                }}
                className="rounded-lg px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <form onSubmit={(event) => void uploadCertificate(event)} className="mt-4 space-y-3">
              <label className="block text-xs">
                Certificate name
                <select
                  required
                  value={certificateType}
                  onChange={(event) => {
                    setCertificateType(event.target.value);
                  }}
                  className={`${inputClass} mt-1`}
                >
                  <option value="">Choose certificate</option>
                  {typeOptions.map((item) => (
                    <option key={item.id} value={item.name ?? item.label ?? item.id}>
                      {item.name ?? item.label ?? item.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                Certificate number
                <input
                  required
                  maxLength={80}
                  value={certificateNumber}
                  onChange={(event) => {
                    setCertificateNumber(event.target.value);
                  }}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="block text-xs">
                Issue date
                <input
                  required
                  type="date"
                  value={issueDate}
                  onChange={(event) => {
                    setIssueDate(event.target.value);
                  }}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="block text-xs">
                Document (PDF, JPG or PNG; up to 4 MB)
                <input
                  required
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => {
                    setCertificateFile(event.target.files?.[0] ?? null);
                  }}
                  className={`${inputClass} mt-1 py-2`}
                />
              </label>
              {certificateError && (
                <p role="alert" className="text-xs text-[var(--danger)]">
                  {certificateError}
                </p>
              )}
              {message && (
                <p role="status" className="text-xs text-[var(--success)]">
                  {message}
                </p>
              )}
              <button
                disabled={!typeOptions.length}
                className="min-h-11 w-full rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
              >
                Upload certificate
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
