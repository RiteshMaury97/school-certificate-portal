import type { ReactNode } from "react";
export default function LoadingOverlay({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      {loading && (
        <div
          className="absolute inset-0 grid place-items-center rounded-xl bg-white/75"
          aria-label="Loading"
          aria-busy="true"
        >
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[var(--primary)]" />
        </div>
      )}
    </div>
  );
}
