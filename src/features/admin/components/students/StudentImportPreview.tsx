import { AlertCircle, CheckCircle2 } from "lucide-react";

import type { StudentImportPreview as Preview, StudentImportRow } from "../../types/admin-state.types";

const tableCell = "px-3 py-2.5 align-top text-left text-xs";

function rowValue(row: StudentImportRow, field: string): string {
  return row.values[field] ?? "";
}

export default function StudentImportPreview({ preview }: { preview: Preview | null }) {
  if (!preview) return null;
  return (
    <div className="border-t border-[var(--divider)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 sm:px-6">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">Validation preview</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {preview.total} rows Â· {preview.valid} ready Â· {preview.errors.length} with errors
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
              {["Excel row", "Student", "Father", "Mother", "Scholar no.", "Class", "Session", "Admission no.", "Date of birth", "Validation"].map(
                (heading) => (
                  <th key={heading} scope="col" className={tableCell}>
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {preview.preview.map((row) => (
              <tr
                key={row.row}
                className={`border-t border-[var(--divider)] ${row.error ? "bg-[var(--surface-2)]" : ""}`}
              >
                <td className={tableCell}>{row.row}</td>
                <td className={tableCell}>{rowValue(row, "studentName") || "â€”"}</td>
                <td className={tableCell}>{rowValue(row, "fatherName") || "â€”"}</td>
                <td className={tableCell}>{rowValue(row, "motherName") || "â€”"}</td>
                <td className={tableCell}>{rowValue(row, "scholarNumber") || "â€”"}</td>
                <td className={tableCell}>{rowValue(row, "className") || "â€”"}</td>
                <td className={tableCell}>{rowValue(row, "session") || "â€”"}</td>
                <td className={tableCell}>{rowValue(row, "admissionNumber") || "â€”"}</td>
                <td className={tableCell}>{rowValue(row, "dateOfBirth") || "â€”"}</td>
                <td className={`${tableCell} max-w-80`}>
                  {row.fieldErrors.length ? (
                    <ul className="space-y-1 text-[var(--danger)]">
                      {row.fieldErrors.map((error, index) => (
                        <li key={`${error.column}-${String(index)}`}>
                          <span className="font-semibold">{error.column}:</span> {error.message}
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
  );
}
