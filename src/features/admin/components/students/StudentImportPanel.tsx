import { Download, FileSpreadsheet, Upload } from "lucide-react";

import { normalizeAcademicSession } from "@/shared/academic-session";
import { MAX_CSV_ROWS } from "@/shared/upload-limits";

import type { CatalogOption } from "../../types/admin-state.types";

import StudentImportPreview from "./StudentImportPreview";
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
              Download the workbook, fill one student per row, validate it, and import only when
              every row is correct. Certificates are added afterward from the student table.
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
              {file ? file.name : "Choose an Excel workbook *"}
            </span>
            <span className="mt-1 text-[10px] text-[var(--text-muted)]">
              .xlsx or .csv · up to 2 MB · maximum {MAX_CSV_ROWS} student rows
            </span>
            <input
              id="student-excel-file"
              aria-label="Choose student import workbook"
              type="file"
              required
              aria-required="true"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={busy}
              onChange={(event) => { setFile(event.target.files?.[0] ?? null); }}
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

      <StudentImportPreview preview={preview} />
    </section>
  );
}
