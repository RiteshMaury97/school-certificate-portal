import ErrorState from "@/components/feedback/ErrorState";

type AdminStatusBannersProps = {
  toast: string;
  error: string;
  onRetry: () => void;
  emergencyLockdown?: boolean;
};

export default function AdminStatusBanners({
  toast,
  error,
  onRetry,
  emergencyLockdown = false,
}: AdminStatusBannersProps) {
  return (
    <>
      {emergencyLockdown && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-3 text-sm font-semibold text-[var(--text)]"
        >
          Emergency lockdown is active. Public certificate lookup, verification, and downloads are
          disabled.
        </p>
      )}
      {toast && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]"
        >
          {toast}
        </p>
      )}
      {error && (
        <div className="mb-4">
          <ErrorState
            title="Admin request could not be completed"
            description={error}
            onRetry={onRetry}
          />
        </div>
      )}
    </>
  );
}
