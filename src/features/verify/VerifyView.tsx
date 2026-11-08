"use client";
/* eslint-disable max-lines-per-function -- reason: this legacy verification page is awaiting a behavior-preserving component extraction. */
import { BadgeCheck, FileCheck2, Fingerprint, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import SiteShell from "@/components/layout/SiteShell";
import { applyCspNonce } from "@/lib/csp";
import { appCheckHeaders } from "@/lib/firebase-client";

import type { SubmitEvent} from "react";


type Verification =
  | {
      valid: true;
      message: "Valid certificate";
      certificateType: string;
      certificateNumber: string;
      session: string;
      issueDate: string;
      schoolName: string;
      studentName: string;
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
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readValidVerification(
  value: Record<string, unknown>,
): Extract<Verification, { valid: true }> | null {
  if (
    value.message !== "Valid certificate" ||
    typeof value.certificateType !== "string" ||
    typeof value.certificateNumber !== "string" ||
    typeof value.session !== "string" ||
    typeof value.issueDate !== "string" ||
    typeof value.schoolName !== "string" ||
    typeof value.studentName !== "string" ||
    typeof value.verifiedOn !== "string"
  ) return null;
  return {
    valid: true,
    message: "Valid certificate",
    certificateType: value.certificateType,
    certificateNumber: value.certificateNumber,
    session: value.session,
    issueDate: value.issueDate,
    schoolName: value.schoolName,
    studentName: value.studentName,
    verifiedOn: value.verifiedOn,
  };
}

function readFailedVerification(
  value: Record<string, unknown>,
): Exclude<Verification, { valid: true }> | null {
  if (typeof value.message !== "string") return null;
  if (value.status === "superseded" && typeof value.newCertificateNumber === "string")
    return {
      valid: false,
      status: "superseded",
      message: value.message,
      newCertificateNumber: value.newCertificateNumber,
    };
  if (value.status === "revoked")
    return { valid: false, status: "revoked", message: value.message };
  return null;
}

function readVerification(value: unknown): Verification | null {
  if (!isRecord(value) || typeof value.valid !== "boolean") return null;
  return value.valid ? readValidVerification(value) : readFailedVerification(value);
}

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
// eslint-disable-next-line complexity -- reason: this view coordinates verification state, API outcomes, and result presentation.
export default function VerifyPage() {
  const [certificateNumber, setCertificateNumber] = useState("");
  const [session, setSession] = useState("");
  const [sessions, setSessions] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsLoadError, setSessionsLoadError] = useState(false);
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
  const formId = useId();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/sessions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load sessions");
        const data: unknown = await response.json();
        if (
          typeof data !== "object" ||
          data === null ||
          !("sessions" in data) ||
          !Array.isArray(data.sessions)
        ) throw new Error("Invalid sessions response");
        return data.sessions.filter(
          (value): value is string => typeof value === "string" && /^\d{4}-\d{2}$/.test(value),
        );
      })
      .then((values) => {
        if (!cancelled) {
          setSessions(values);
          setSessionsLoadError(false);
          setSession((current) => values.includes(current) ? current : "");
        }
      })
      .catch(() => {
        if (!cancelled) setSessionsLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionsRetry]);

  useEffect(() => {
    if (!effectiveSiteKey || !captchaRef.current) {
      setCaptchaError(true);
      return;
    }
    let cancelled = false;
    const scriptId = "cloudflare-turnstile-script";
    const existing = document.querySelector<HTMLScriptElement>(`script#${scriptId}`);
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
          "expired-callback": () => { setCaptchaToken(""); },
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
      applyCspNonce(script);
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => { setCaptchaError(true); };
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [effectiveSiteKey, captchaRetry]);

  useEffect(() => {
    const shouldNoIndex = Boolean(result ?? failed);
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
    setFailed(false);
    setNetworkError(false);
    setResult(null);
    if (
      !certificateNumber.trim() ||
      certificateNumber.trim().length > 80 ||
      !/^\d{4}-\d{2}$/.test(session.trim()) ||
      !captchaToken
    ) {
      setFailed(true);
      return;
    }
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
          session: session.trim(),
          turnstileToken: captchaToken,
        }),
        cache: "no-store",
      });
      const data: unknown = await response.json();
      const verification = readVerification(data);
      if (!response.ok || !verification)
        throw new Error("verification");
      setResult(verification);
    } catch {
      setNetworkError(true);
    } finally {
      setLoading(false);
      setCaptchaToken("");
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl">
        <header className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--primary)] px-6 py-8 text-[var(--on-primary)] shadow-[var(--shadow-card)] sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border-[32px] border-white/5" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-white/70"><ShieldCheck size={15} /> Public certificate service</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{"Verify a certificate"}</h1>
              <p className="mt-3 text-sm leading-6 text-white/80 sm:text-base">Confirm that a certificate was issued by the school using its number and academic session.</p>
            </div>
            <div className="grid h-16 w-16 shrink-0 place-items-center self-start rounded-2xl border border-white/15 bg-white/10 sm:self-center"><FileCheck2 size={30} aria-hidden="true" /></div>
          </div>
          <p className="relative mt-6 border-t border-white/15 pt-4 text-xs leading-5 text-white/70">Verification confirms the certificate record. The original document and private student details are not displayed.</p>
        </header>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[var(--text)]">Certificate details</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Enter both details exactly as they appear on the certificate.</p>
          </div>
          <form
            ref={formRef}
            onSubmit={(event) => {
              void submit(event);
            }}
            noValidate
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label
                htmlFor={`${formId}-number`}
                className="text-sm font-semibold text-[var(--text)]"
              >
                Certificate number <span className="text-[var(--danger)]" aria-hidden="true">*</span>
                <input
                  translate="no"
                  id={`${formId}-number`}
                  required aria-required="true"
                  maxLength={80}
                  autoComplete="off"
                  value={certificateNumber}
                  onChange={(event) => { setCertificateNumber(event.target.value); }}
                  placeholder="Enter the certificate number"
                  aria-label="Certificate number (required)"
                  className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-base font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                />
              </label>
              <label
                htmlFor={`${formId}-session`}
                className="text-sm font-semibold text-[var(--text)]"
              >
                Academic session <span className="text-[var(--danger)]" aria-hidden="true">*</span>
                <select
                  translate="no"
                  id={`${formId}-session`}
                  required aria-required="true"
                  value={session}
                  onChange={(event) => { setSession(event.target.value); }}
                  disabled={sessionsLoading || sessionsLoadError || sessions.length === 0}
                  aria-label="Academic session (required)"
                  className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-base font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                >
                  <option value="">
                    {sessionsLoading ? "Loading sessions…" : sessionsLoadError ? "Sessions unavailable" : sessions.length ? "Select academic session" : "No sessions available"}
                  </option>
                  {sessions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">Select the academic session shown on the certificate.</span>
                {sessionsLoadError && (
                  <div className="mt-2">
                    <ErrorState
                      title="Sessions could not be loaded"
                      description="Check your connection and retry."
                      onRetry={() => { setSessionsLoadError(false); setSessionsLoading(true); setSessionsRetry((value) => value + 1); }}
                    />
                  </div>
                )}
                {!sessionsLoading && !sessionsLoadError && sessions.length === 0 && (
                  <span className="mt-1 block text-xs font-normal text-[var(--text-muted)]" role="status">No academic sessions are available. Please contact the school office.</span>
                )}
              </label>
            </div>
            <div className="mt-6 rounded-2xl bg-[var(--surface-2)] p-4 sm:p-5">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <Fingerprint size={16} aria-hidden="true" />
                {"Security verification"}
              </p>
              <div
                ref={captchaRef}
                className="min-h-[66px]"
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
              disabled={loading || !captchaReady || !captchaToken || !certificateNumber.trim() || !/^\d{4}-\d{2}$/.test(session.trim())} aria-busy={loading}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <><LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Verifying certificate…</> : <><BadgeCheck size={17} aria-hidden="true" /> Verify certificate</>}
            </button>
          </form>
        </div>
        {failed && !loading && (
          <div className="mt-6">
            <EmptyState title={genericFailure} />
          </div>
        )}
        {networkError && !loading && (
          <div className="mt-6" role="alert">
            <ErrorState
              title="Verification could not be completed"
              description="Check your connection and try again."
              onRetry={() => formRef.current?.requestSubmit()}
            />
          </div>
        )}
        {result && !loading && (
          <section
            aria-live="polite"
            translate="no"
            className={`notranslate mt-6 overflow-hidden rounded-3xl border bg-[var(--surface)] shadow-[var(--shadow-card)] ${result.valid ? "border-emerald-700/20" : "border-[var(--border)]"}`}
          >
            <div className={`flex items-center gap-4 px-6 py-5 ${result.valid ? "bg-emerald-700/10" : "bg-[var(--surface-2)]"}`}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--primary)] shadow-sm">
                {result.valid ? <BadgeCheck size={26} /> : <ShieldCheck size={24} />}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-[var(--text-muted)]">Verification result</p>
                <h2 className="mt-1 text-xl font-bold text-[var(--text)] sm:text-2xl">
                  {result.valid
                    ? "Valid certificate"
                    : result.status === "superseded"
                      ? "Certificate replaced"
                      : "Certificate revoked"}
                </h2>
              </div>
            </div>
            {!result.valid && result.status === "superseded" && (
              <p className="mt-4 text-sm text-[var(--text)]">
                This certificate has been replaced. New certificate number:{" "}
                <strong className="notranslate" translate="no">
                  {result.newCertificateNumber}
                </strong>
              </p>
            )}
            {result.valid && (
              <dl className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
                <div className="rounded-xl bg-[var(--surface-2)] p-4">
                  <dt className="text-xs font-medium text-[var(--text-muted)]">Certificate number</dt>
                  <dd className="mt-1 break-all font-semibold text-[var(--text)] notranslate" translate="no">{result.certificateNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">Certificate type</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">
                    {result.certificateType}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">Academic session</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">{result.session}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">Issue date</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">
                    {displayDate(result.issueDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">School</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">{result.schoolName}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-[var(--text-muted)]">Student identity</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)] notranslate" translate="no">
                    {result.studentName} <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">(partially hidden for privacy)</span>
                  </dd>
                </div>
              </dl>
            )}
            {result.valid && (
              <p className="mx-5 mb-5 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)] sm:mx-6">
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

