type IdleWarningModalProps = {
  onLogout: () => void;
  onStaySignedIn: () => void;
};

export default function IdleWarningModal({ onLogout, onStaySignedIn }: IdleWarningModalProps) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      className="fixed inset-0 z-[100] grid place-items-center bg-[var(--scrim)] p-4"
    >
      <section className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 text-[var(--text)] shadow-2xl">
        <h2 id="idle-title" className="text-xl font-bold">
          Session expiring soon
        </h2>
        <p className="mt-2 text-sm">
          You have been inactive for nearly 6 hours. You will be signed out after 6 hours of
          inactivity.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onLogout} className="rounded-lg border px-4 py-2">
            Sign out
          </button>
          <button
            onClick={onStaySignedIn}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-[var(--on-primary)]"
          >
            Stay signed in
          </button>
        </div>
      </section>
    </div>
  );
}
