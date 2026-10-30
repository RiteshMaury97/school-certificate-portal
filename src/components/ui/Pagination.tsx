export default function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <button
        className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => { onChange(page - 1); }}
      >
        Previous
      </button>
      <span className="text-sm text-slate-600">
        Page {page} of {Math.max(1, pages)}
      </span>
      <button
        className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
        disabled={page >= pages}
        onClick={() => { onChange(page + 1); }}
      >
        Next
      </button>
    </nav>
  );
}
