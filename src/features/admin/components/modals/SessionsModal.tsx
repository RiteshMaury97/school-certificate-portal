type SessionsModalProps = {
  sessions: Record<string, unknown>[];
  recentLogins: Record<string, unknown>[];
  onClose: () => void;
  onRevokeSession: (sessionId: string) => void;
  onRevokeAll: () => void;
};

export default function SessionsModal({
  sessions,
  recentLogins,
  onClose,
  onRevokeSession,
  onRevokeAll,
}: SessionsModalProps) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sessions-title" className="fixed inset-0 z-[90] grid place-items-center bg-[var(--scrim)] p-4">
      <section className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--text)]">
        <div className="flex justify-between">
          <h2 id="sessions-title" className="text-xl font-bold">Active sessions / recent logins</h2>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="mt-4 space-y-3">
          {sessions.map((session, i) => (
            <div key={String(session.sessionId ?? i)} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-semibold">
                  {String(session.browser ?? "Device")} · {String(session.city ?? "Unknown city")}
                  {session.country ? `, ${String(session.country)}` : ""} {session.current ? "· This device" : ""}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Signed in: {String(session.createdAt ?? "Unknown")} · Last activity: {String(session.lastActivityAt ?? "Unknown")}
                </p>
              </div>
              {session.revoked ? <span>Revoked</span> : (
                <button onClick={() => { onRevokeSession(String(session.sessionId)); }} className="rounded-lg border px-3 py-2">Revoke</button>
              )}
            </div>
          ))}
        </div>
        <h3 className="mt-6 font-semibold">Recent logins</h3>
        <div className="mt-2 space-y-2">
          {recentLogins.map((login, i) => (
            <div key={i} className="rounded-lg border p-3 text-sm">
              <b>{String(login.browser ?? "Device")} · {String(login.city ?? "Unknown city")}{login.country ? `, ${String(login.country)}` : ""}</b>
              <p className="text-xs text-[var(--text-muted)]">Last seen: {String(login.lastSeenAt ?? "Unknown")}</p>
            </div>
          ))}
        </div>
        <button onClick={onRevokeAll} className="mt-5 rounded-lg bg-[var(--primary)] px-4 py-3 text-[var(--on-primary)]">Sign out of all devices</button>
      </section>
    </div>
  );
}
