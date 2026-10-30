import type { ReactNode } from "react";
import EmptyState from "@/src/components/EmptyState";

export default function Table({
  headers,
  rows,
  emptyAction,
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyAction?: ReactNode;
}) {
  return (
    <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {rows.length === 0 ? (
        <EmptyState title="No data found" action={emptyAction} className="m-3" />
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--surface-2)]">
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-[var(--border)]">
                {row.map((cell, column) => (
                  <td key={column} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
