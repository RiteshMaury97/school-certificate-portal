"use client";
import { useEffect, useId, useRef, useState } from "react";

import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import SiteShell from "@/components/layout/SiteShell";
import { appCheckHeaders } from "@/lib/firebase-client";

import type { SubmitEvent } from "react";

type Verification =
  | {
      valid: true;
      message: "Valid certificate";
      certificateType: string;
      session: string;
      issueDate: string;
      schoolName: string;
      studentName: string;
      fatherName: string;
      motherName: string;
      className: string;
      scholarNumber: string;
      verifiedOn: string;
    }
  | {
      valid: false;
      status: "superseded";
      message: string;
      newCertificateNumber: string;
    }
  | { valid: false; status: "revoked"; message: string };
const genericFailure = "No matching certificate found";
type SessionsResponse = { sessions: string[] };
function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(date);
}
export default function VerifyPage() {
  const [certificateNumber, setCertificateNumber] = useState("");
  const [session, setSession] = useState("");
  const [sessions, setSessions] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [sessionsRetry, setSessionsRetry] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [captchaRetry, setCaptchaRetry] = useState(0);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const effectiveSiteKey =
    siteKey || (process.env.NODE_ENV === "development" ? "1x00000000000000000000AA" : "");

  const [result, setResult] = useState<Verification | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const widgetId = useRef<string | null>(null);
  const requestInFlight = useRef(false);
  const formId = useId();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/sessions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session list unavailable");
        return response.json() as Promise<SessionsResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setSessions(data.sessions ?? []);
          setSessionsError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSessionsError(true);
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionsRetry]);

  useEffect(() => {
    if (!effectiveSiteKey || !captchaRef.current) {
      setCaptchaError(true);
      return;
    }
    let cancelled = false;
    const scriptId = "cloudflare-turnstile-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    const render = () => {
      if (cancelled || !captchaRef.current || !window.turnstile || widgetId.current) return;
      try {
        widgetId.current = window.turnstile.render(captchaRef.current, {
          sitekey: effectiveSiteKey,
          appearance: "always",
          callback: (token) => {
            setCaptchaToken(token);
            setCaptchaError(false);
          },
          "expired-callback": () => {
            setCaptchaToken("");
          },
          "error-callback": () => {
            setCaptchaToken("");
            setCaptchaError(true);
          },
        });
        setCaptchaReady(true);
      } catch {
        setCaptchaError(true);
      }
    };
    if (window.turnstile) render();
    else if (existing) existing.addEventListener("load", render, { once: true });
    else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => {
        setCaptchaError(true);
      };
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [effectiveSiteKey, captchaRetry]);

  useEffect(() => {
    const shouldNoIndex = Boolean(result || failed);
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const original = meta?.content;
    if (shouldNoIndex) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "robots";
        document.head.appendChild(meta);
      }
      meta.content = "noindex, nofollow, noarchive";
    } else if (meta && original) meta.content = original;
    return () => {
      if (meta && original) meta.content = original;
    };
  }, [result, failed]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestInFlight.current) return;
    setFailed(false);
    setNetworkError(false);
    setResult(null);
    if (
      !certificateNumber.trim() ||
      certificateNumber.trim().length > 80 ||
      !session ||
      !captchaToken
    ) {
      setFailed(true);
      return;
    }
    requestInFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch("/api/certificates/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({
          certificateNumber,
          session,
          turnstileToken: captchaToken,
        }),
        cache: "no-store",
      });
      const data: unknown = await response.json();
      if (!response.ok || typeof data !== "object" || data === null)
        throw new Error("verification");
      if ("valid" in data && data.valid === true) setResult(data as Verification);
      else if ("status" in data && (data.status === "superseded" || data.status === "revoked"))
        setResult(data as Verification);
      else setFailed(true);
    } catch {
      setNetworkError(true);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setCaptchaToken("");
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl">
        <header className="relative overflow-hidden rounded-3xl bg-[var(--primary)] px-6 py-8 text-[var(--on-primary)] shadow-[var(--shadow-card)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-10 -top-16 h-56 w-56 rounded-full border-[36px] border-[var(--on-primary)]/10"
          />
          <p className="relative text-xs font-bold uppercase tracking-[.2em] opacity-80">
            Public certificate service
          </p>
          <h1 className="relative mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Verify a certificate
          </h1>
          <p className="relative mt-3 max-w-2xl text-sm leading-6 opacity-90">
            Check that a certificate number belongs to a published school record. Verification
            confirms its status and does not provide access to the original document.
          </p>
        </header>
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(250px,.8fr)]">
          <div className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
            <div className="mb-5 border-b border-[var(--divider)] pb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">
                Verification details
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Enter both required details to find the matching certificate record.
              </p>
            </div>
            <form ref={formRef} onSubmit={submit} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <label
                  htmlFor={`${formId}-number`}
                  className="text-sm font-semibold text-[var(--text)]"
                >
                  Certificate Number{" "}
                  <span aria-hidden="true" className="text-[var(--danger)]">
                    *
                  </span>
                  <input
                    translate="no"
                    id={`${formId}-number`}
                    required
                    maxLength={80}
                    autoComplete="off"
                    value={certificateNumber}
                    onChange={(event) => {
                      setCertificateNumber(event.target.value);
                    }}
                    placeholder="Enter the certificate number"
                    className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-base font-normal text-[var(--text)] outline-none transition focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                  />
                </label>
                <label
                  htmlFor={`${formId}-session`}
                  className="text-sm font-semibold text-[var(--text)]"
                >
                  Passing Session{" "}
                  <span aria-hidden="true" className="text-[var(--danger)]">
                    *
                  </span>
                  <select
                    translate="no"
                    id={`${formId}-session`}
                    required
                    value={session}
                    onChange={(event) => {
                      setSession(event.target.value);
                    }}
                    disabled={sessionsLoading || sessionsError || sessions.length === 0 || loading}
                    className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-base font-normal text-[var(--text)] outline-none transition focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {sessionsLoading ? "Loading active sessions…" : "Choose a passing session"}
                    </option>
                    {sessions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  {sessionsError && (
                    <button
                      type="button"
                      onClick={() => {
                        setSessionsLoading(true);
                        setSessionsError(false);
                        setSessionsRetry((value) => value + 1);
                      }}
                      className="mt-1 text-xs font-semibold text-[var(--primary)]"
                    >
                      Sessions could not load. Retry.
                    </button>
                  )}
                  {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                    <span className="mt-1 block text-xs text-[var(--danger)]">
                      No sessions are available. Contact the school office.
                    </span>
                  )}
                </label>
              </div>
              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold text-[var(--text)]">
                  {"Security verification"}
                </p>
                <div
                  ref={captchaRef}
                  className="min-h-[66px] rounded-xl border border-[var(--divider)] bg-[var(--surface-2)] p-2"
                  aria-label="Cloudflare security verification"
                />
                {!captchaReady && !captchaError && (
                  <p className="text-xs text-[var(--text-muted)]" role="status">
                    Loading security verification…
                  </p>
                )}
                {captchaError && (
                  <div className="mt-2">
                    <ErrorState
                      title="Security check could not load"
                      description="The verification service is unavailable. This form cannot be submitted until the security check loads."
                      onRetry={() => {
                        if (widgetId.current && window.turnstile)
                          window.turnstile.remove(widgetId.current);
                        widgetId.current = null;
                        setCaptchaToken("");
                        setCaptchaReady(false);
                        setCaptchaError(false);
                        const script = document.getElementById("cloudflare-turnstile-script");
                        if (script && !(window as Window & { turnstile?: unknown }).turnstile)
                          script.remove();
                        setCaptchaRetry((value) => value + 1);
                      }}
                    />
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={
                  loading ||
                  !captchaReady ||
                  !captchaToken ||
                  !certificateNumber.trim() ||
                  !session ||
                  sessionsLoading ||
                  sessionsError ||
                  sessions.length === 0
                }
                aria-busy={loading}
                className="mt-6 min-h-12 w-full rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify Certificate"}
              </button>
            </form>
          </div>
          <aside className="h-fit rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] lg:sticky lg:top-6">
            <h2 className="text-sm font-bold text-[var(--text)]">How verification works</h2>
            <ol className="mt-4 space-y-4 text-sm">
              {[
                [
                  "01",
                  "Enter the certificate number",
                  "Use the number printed on the certificate.",
                ],
                [
                  "02",
                  "Choose the passing session",
                  "The session must match the certificate record.",
                ],
                [
                  "03",
                  "Verify securely",
                  "We confirm the record status without showing the document.",
                ],
              ].map(([number, title, description]) => (
                <li key={number} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-bold text-[var(--primary)]">
                    {number}
                  </span>
                  <div>
                    <h3 className="font-semibold text-[var(--text)]">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 rounded-xl bg-[var(--surface-2)] p-4 text-xs leading-5 text-[var(--text-muted)]">
              Certificate number and session are required to avoid matching the wrong record. Do not
              share personal information in this form.
            </p>
          </aside>
        </div>
        {failed && !loading && (
          <div className="mt-6">
            <EmptyState title={genericFailure} />
          </div>
        )}
        {result && !loading && (
          <section
            aria-live="polite"
            translate="no"
            className={`notranslate mt-6 rounded-2xl border bg-[var(--surface)] p-6 shadow-sm ${result.valid ? "border-[var(--border)]" : "border-[var(--border)]"}`}
          >
            <h2 className="mt-2 text-2xl font-bold text-[var(--text)]">
              {result.valid
                ? "Valid certificate"
                : result.status === "superseded"
                  ? "Certificate replaced"
                  : "Certificate revoked"}
            </h2>
            {!result.valid && result.status === "superseded" && (
              <p className="mt-4 text-sm text-[var(--text)]">
                This certificate has been replaced. New certificate number:{" "}
                <strong className="notranslate" translate="no">
                  {result.newCertificateNumber}
                </strong>
              </p>
            )}
            {result.valid && (
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Certificate type</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">
                    {result.certificateType}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Session</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">{result.session}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Issue date</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">
                    {displayDate(result.issueDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">School</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">{result.schoolName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Student name</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)] notranslate" translate="no">
                    {result.studentName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Father name</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">
                    {result.fatherName || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Mother name</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">
                    {result.motherName || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Class / section</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">
                    {result.className || "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Scholar number</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">
                    {result.scholarNumber || "Not available"}
                  </dd>
                </div>
              </dl>
            )}
            {result.valid && (
              <p className="mt-5 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">
                Verified on{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "medium",
                  timeZone: "Asia/Kolkata",
                }).format(new Date(result.verifiedOn))}{" "}
                (IST)
              </p>
            )}
          </section>
        )}
      </section>
    </SiteShell>
  );
}
