"use client";
export default function DownloadActions({
  onDownload,
  onPrint,
}: {
  onDownload: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={onDownload}
        className="min-h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)]"
      >
        Download all
      </button>
      <button
        onClick={onPrint}
        className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold"
      >
        Print view
      </button>
    </div>
  );
}
