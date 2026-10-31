type Props = { label?: string; fullscreen?: boolean };

/** Branded full-page loader shown while a route or the admin session is being resolved. */
export default function PageLoader({ label = "Loading…", fullscreen = true }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`grid place-items-center bg-[var(--bg)] text-[var(--text)] ${
        fullscreen ? "min-h-dvh" : "min-h-[50dvh]"
      }`}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative grid h-16 w-16 place-items-center">
          <span
            aria-hidden="true"
            className="spinner absolute inset-0 text-[var(--gold)]"
            style={{ width: 64, height: 64, borderWidth: 3 }}
          />
          <span
            aria-hidden="true"
            className="animate-breathe grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary)] text-[11px] font-bold tracking-wide text-[var(--on-primary)]"
          >
            SIS
          </span>
        </div>
        <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}
