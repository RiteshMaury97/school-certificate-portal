import { Activity, Clock3, Globe2, Laptop2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import PaginationControls from "../shared/PaginationControls";

type Props = {
  sessions: Record<string, unknown>[];
  recentLogins: Record<string, unknown>[];
  error: string;
  onRetry: () => void;
  onRevokeSession: (sessionId: string) => void;
  onRevokeAll: () => void;
};

function locationOf(value: Record<string, unknown>) {
  const rawCity = typeof value.city === "string" ? value.city.trim() : "";
  const city = rawCity.toLowerCase() === "unknown city" ? "" : rawCity;
  const country = typeof value.country === "string" ? value.country.trim() : "";
  return [city, country].filter(Boolean).join(", ") || "Location unavailable";
}

function dateOf(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function textOf(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default function SessionsTab({
  sessions,
  recentLogins,
  error,
  onRetry,
  onRevokeSession,
  onRevokeAll,
}: Props) {
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);
  const [loginPage, setLoginPage] = useState(1);
  const pageSize = 5;
  const sessionPageCount = Math.max(1, Math.ceil(sessions.length / pageSize));
  const loginPageCount = Math.max(1, Math.ceil(recentLogins.length / pageSize));
  const currentSessionPage = Math.min(sessionPage, sessionPageCount);
  const currentLoginPage = Math.min(loginPage, loginPageCount);
  const visibleSessions = sessions.slice((currentSessionPage - 1) * pageSize, currentSessionPage * pageSize);
  const visibleLogins = recentLogins.slice((currentLoginPage - 1) * pageSize, currentLoginPage * pageSize);
  const activeCount = sessions.filter((item) => item.revoked !== true).length;
  const currentCount = sessions.filter((item) => item.current === true).length;
  return (
    <main className="mx-auto max-w-6xl space-y-6 text-[var(--text)]">
      <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)]">
        <div className="bg-[linear-gradient(115deg,var(--primary),color-mix(in_srgb,var(--primary)_74%,#101f2a))] px-6 py-7 text-[var(--on-primary)] sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-80"><ShieldCheck size={15} /> Account security</div>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Sessions &amp; sign-ins</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">Review the devices signed in to your administrator account, check their reported locations, and end sessions you don’t recognize.</p>
            </div>
            {confirmRevokeAll ? <div className="flex flex-wrap items-center gap-2"><span className="text-sm">End all sessions?</span><button type="button" onClick={() => { onRevokeAll(); }} className="min-h-10 rounded-lg bg-white px-4 text-sm font-bold text-[var(--primary)]">Confirm</button><button type="button" onClick={() => { setConfirmRevokeAll(false); }} className="min-h-10 rounded-lg border border-white/35 px-4 text-sm font-semibold">Cancel</button></div> : <button type="button" onClick={() => { setConfirmRevokeAll(true); }} className="min-h-10 rounded-lg border border-white/35 px-4 text-sm font-semibold hover:bg-white/10">Sign out everywhere</button>}
          </div>
        </div>
        <div className="grid gap-px bg-[var(--divider)] sm:grid-cols-3">
          <div className="bg-[var(--surface)] p-5"><p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Active sessions</p><p className="mt-1 text-2xl font-bold">{activeCount}</p></div>
          <div className="bg-[var(--surface)] p-5"><p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">This device</p><p className="mt-1 text-2xl font-bold">{currentCount ? "Current" : "Not listed"}</p></div>
          <div className="bg-[var(--surface)] p-5"><p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Recent devices</p><p className="mt-1 text-2xl font-bold">{recentLogins.length}</p></div>
        </div>
      </section>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--danger)]/40 bg-[var(--surface)] p-4 text-sm"><span>{error}</span><button type="button" onClick={onRetry} className="rounded-lg border border-[var(--divider)] px-3 py-2 font-semibold">Try again</button></div>}

      <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)]">
        <div className="flex items-center gap-3 border-b border-[var(--divider)] px-5 py-4 sm:px-6"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]"><Laptop2 size={19}/></span><div><h3 className="font-bold">Signed-in devices</h3><p className="text-xs text-[var(--text-muted)]">Session activity and location reported at sign-in</p></div></div>
        {sessions.length === 0 ? <p className="p-6 text-sm text-[var(--text-muted)]">No session records are available.</p> : <div className="divide-y divide-[var(--divider)]">
          {visibleSessions.map((session, index) => <article key={textOf(session.sessionId, `session-${((currentSessionPage - 1) * pageSize + index).toString()}`)} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{textOf(session.browser, "Device")}</h4>{session.current === true && <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--primary)]">This device</span>}{session.revoked === true && <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]">Ended</span>}</div>
              <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-[var(--text-muted)] sm:grid-cols-2"><span className="inline-flex items-center gap-1.5"><Globe2 size={13}/>{locationOf(session)}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={13}/>Signed in {dateOf(session.createdAt)}</span><span className="inline-flex items-center gap-1.5"><Activity size={13}/>Last active {dateOf(session.lastActivityAt)}</span></div>
            </div>
            {session.revoked !== true && <button type="button" onClick={() => { onRevokeSession(textOf(session.sessionId, "")); }} className="min-h-10 shrink-0 rounded-lg border border-[var(--divider)] px-4 text-sm font-semibold hover:border-[var(--danger)] hover:text-[var(--danger)]">End session</button>}
          </article>)}
        </div>}
        {sessions.length > 0 && <PaginationControls label="Signed-in devices" page={currentSessionPage} pageCount={sessionPageCount} pageSize={pageSize} total={sessions.length} onPageChange={setSessionPage} />}
      </section>

      <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)]">
        <div className="border-b border-[var(--divider)] px-5 py-4 sm:px-6"><h3 className="font-bold">Recent sign-ins</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Known devices seen on your account</p></div>
        {recentLogins.length === 0 ? <p className="p-6 text-sm text-[var(--text-muted)]">No recent sign-ins are available.</p> : <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">{visibleLogins.map((login, index) => <article key={`${textOf(login.browser, "device")}-${(((currentLoginPage - 1) * pageSize) + index).toString()}`} className="rounded-xl border border-[var(--divider)] bg-[var(--surface-2)]/40 p-4"><h4 className="font-semibold">{textOf(login.browser, "Device")}</h4><p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)]"><Globe2 size={14}/>{locationOf(login)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Last seen {dateOf(login.lastSeenAt)}</p></article>)}</div>}
        {recentLogins.length > 0 && <PaginationControls label="Recent sign-ins" page={currentLoginPage} pageCount={loginPageCount} pageSize={pageSize} total={recentLogins.length} onPageChange={setLoginPage} />}
      </section>
      <p className="text-xs leading-5 text-[var(--text-muted)]">Locations are provided by the hosting network when available. They can be approximate or unavailable, for example when a sign-in is local.</p>
    </main>
  );
}
