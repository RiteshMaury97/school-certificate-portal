import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";

import { normalizeAcademicSession } from "@/shared/academic-session";

import type {
  CatalogOption,
  StudentImportPreview,
  StudentImportRow,
} from "../../types/admin-state.types";
type Props = {
  busy: boolean;
  file: File | null;
  setFile: (file: File | null) => void;
  preview: StudentImportPreview | null;
  importStudents: (action: "preview" | "commit") => Promise<void>;
  downloadTemplate: () => Promise<void>;
  classOptions: CatalogOption[];
  sessionOptions: CatalogOption[];
};

const tableCell = "px-3 py-2.5 align-top text-left text-xs";

function classLabel(option: CatalogOption): string {
  return option.label ?? option.name ?? option.id;
}

function activeClassNames(options: CatalogOption[]): string[] {
  return options
    .filter((option) => option.isActive !== false)
    .map(classLabel)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function activeSessionNames(options: CatalogOption[]): string[] {
  return [
    ...new Set(
      options
        .filter((option) => option.isActive !== false)
        .map(
          (option) =>
            normalizeAcademicSession(option.label ?? "") ??
            normalizeAcademicSession(option.name ?? "") ??
            normalizeAcademicSession(option.id),
        )
        .filter((value): value is string => value !== null),
    ),
  ].sort();
}

function rowValue(row: StudentImportRow, field: string): string {
  return row.values[field] ?? "";
}

function CatalogValues({
  title,
  values,
  emptyMessage,
}: {
  title: string;
  values: string[];
  emptyMessage: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--divider)] bg-[var(--surface-2)] p-4">
      <h3 className="text-xs font-semibold text-[var(--text)]">{title}</h3>
      {values.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li
              key={value}
              className="rounded-md border border-[var(--divider)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text)]"
            >
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[10px] text-[var(--danger)]">{emptyMessage}</p>
      )}
    </div>
  );
}

export default function StudentImportPanel({
  busy,
  file,
  setFile,
  preview,
  importStudents,
  downloadTemplate,
  classOptions,
  sessionOptions,
}: Props) {
  const classes = activeClassNames(classOptions);
  const sessions = activeSessionNames(sessionOptions);
  const canCommit = Boolean(
    file && preview && preview.total > 0 && preview.total === preview.valid,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--divider)] bg-[var(--surface-2)] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary)] text-[var(--on-primary)]">
            <FileSpreadsheet size={19} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              Student register
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">
              Import students from Excel
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--text-muted)]">
              Download the workbook, fill one student per row, validate it, and
              import only when every row is correct. Certificates are added
              afterward from the student table.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void downloadTemplate()}
          disabled={busy}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] disabled:opacity-50"
        >
          <Download size={14} aria-hidden="true" />
          Download Excel template
        </button>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,.9fr)]">
        <div>
          <label
            htmlFor="student-excel-file"
            className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-5 text-center transition hover:border-[var(--primary)]"
          >
            <Upload size={19} aria-hidden="true" className="text-[var(--primary)]" />
            <span className="mt-2 text-sm font-semibold text-[var(--text)]">
              {file ? file.name : "Choose an Excel workbook"}
            </span>
            <span className="mt-1 text-[10px] text-[var(--text-muted)]">
              .xlsx or .csv · up to 5 MB · maximum 500 student rows
            </span>
            <input
              id="student-excel-file"
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={busy}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void importStudents("preview")}
              disabled={!file || busy}
              className="min-h-10 rounded-lg border border-[var(--divider)] px-4 text-xs font-semibold text-[var(--text)] disabled:opacity-50"
            >
              Preview and validate
            </button>
            <button
              type="button"
              onClick={() => void importStudents("commit")}
              disabled={!canCommit || busy}
              className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--on-primary)] disabled:opacity-50"
            >
              Import {preview?.valid ?? 0} valid students
            </button>
          </div>
        </div>

        <div className="grid content-start gap-3">
          <CatalogValues
            title="Class names — enter exactly as shown"
            values={classes}
            emptyMessage="No active classes found. Add class names in the Classes catalog before importing."
          />
          <CatalogValues
            title="Academic sessions — YYYY-YY"
            values={sessions}
            emptyMessage="No active sessions found. Add sessions in the Sessions catalog before importing."
          />
        </div>
      </div>

      {preview && (
        <div className="border-t border-[var(--divider)]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-6">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)]">
                Validation preview
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {preview.total} rows · {preview.valid} ready ·{" "}
                {preview.errors.length} with errors
              </p>
            </div>
            {preview.valid === preview.total ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-semibold text-[var(--primary)]">
                <CheckCircle2 size={13} aria-hidden="true" />
                All rows validated
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-semibold text-[var(--danger)]">
                <AlertCircle size={13} aria-hidden="true" />
                Correct Excel errors before importing
              </span>
            )}
          </div>
          <div className="max-h-[28rem] overflow-auto border-t border-[var(--divider)]">
            <table className="w-full min-w-[1050px] border-collapse text-[var(--text)]">
              <thead className="sticky top-0 z-10 bg-[var(--surface-2)]">
                <tr>
                  {[
                    "Excel row",
                    "Student",
                    "Father",
                    "Mother",
                    "Scholar no.",
                    "Class",
                    "Session",
                    "Admission no.",
                    "Validation",
                  ].map((heading) => (
                    <th key={heading} scope="col" className={tableCell}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row) => (
                  <tr
                    key={row.row}
                    className={`border-t border-[var(--divider)] ${
                      row.error ? "bg-[var(--surface-2)]" : ""
                    }`}
                  >
                    <td className={tableCell}>{row.row}</td>
                    <td className={tableCell}>{rowValue(row, "studentName") || "—"}</td>
                    <td className={tableCell}>{rowValue(row, "fatherName") || "—"}</td>
                    <td className={tableCell}>{rowValue(row, "motherName") || "—"}</td>
                    <td className={tableCell}>{rowValue(row, "scholarNumber") || "—"}</td>
                    <td className={tableCell}>{rowValue(row, "className") || "—"}</td>
                    <td className={tableCell}>{rowValue(row, "session") || "—"}</td>
                    <td className={tableCell}>{rowValue(row, "admissionNumber") || "—"}</td>
                    <td className={`${tableCell} max-w-80`}>
                      {row.fieldErrors.length ? (
                        <ul className="space-y-1 text-[var(--danger)]">
                          {row.fieldErrors.map((error, index) => (
                            <li key={`${error.column}-${index}`}>
                              <span className="font-semibold">{error.column}:</span>{" "}
                              {error.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="font-medium text-[var(--primary)]">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
