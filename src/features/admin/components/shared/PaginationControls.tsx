import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  label: string;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export default function PaginationControls({
  label,
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
}: Props) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <nav
      aria-label={`${label} pagination`}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--divider)] px-5 py-3"
    >
      <p className="text-xs text-[var(--text-muted)]">
        Showing <span className="font-semibold text-[var(--text)]">{start}–{end}</span> of{" "}
        <span className="font-semibold text-[var(--text)]">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1);
          }}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--divider)] px-3 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          <ChevronLeft size={15} aria-hidden="true" /> Previous
        </button>
        <span aria-live="polite" className="min-w-16 text-center text-xs font-medium text-[var(--text-muted)]">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => {
            onPageChange(page + 1);
          }}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--divider)] px-3 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          Next <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
