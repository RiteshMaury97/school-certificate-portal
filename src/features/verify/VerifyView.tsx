"use client";
import { useEffect, useId, useRef, useState } from "react";

import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import SiteShell from "@/components/layout/SiteShell";
import { appCheckHeaders } from "@/lib/firebase-client";

import type { FormEvent} from "react";

type Verification =
  | {
      valid: true;
      message: "Valid certificate";
      certificateType: string;
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(false);
    setNetworkError(false);
    setResult(null);
    if (!certificateNumber.trim() || certificateNumber.trim().length > 80 || !captchaToken) {
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
          ...(session.trim() ? { session: session.trim() } : {}),
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
      setLoading(false);
      setCaptchaToken("");
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-4xl">
        <div className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 text-center shadow-[var(--shadow-card)] sm:px-10 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--text-muted)]">
            {"Public certificate service"}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            {"Verify a Certificate"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            Check whether a certificate number matches a certificate issued by the school.
            Verification does not reveal or provide access to the original document.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-8">
          <form ref={formRef} onSubmit={submit} noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <label
                htmlFor={`${formId}-number`}
                className="text-sm font-semibold text-[var(--text-muted)] sm:col-span-2"
              >
                {"Certificate Number"}
                <input
                  translate="no"
                  id={`${formId}-number`}
                  required
                  maxLength={80}
                  autoComplete="off"
                  value={certificateNumber}
                  onChange={(event) => { setCertificateNumber(event.target.value); }}
                  placeholder="Enter the certificate number"
                  className="mt-2 min-h-12 w-full rounded-lg border border-[var(--border)] px-3.5 py-3 text-base font-normal outline-none focus-visible:border-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--border)]/20"
                />
              </label>
              <label
                htmlFor={`${formId}-session`}
                className="text-sm font-semibold text-[var(--text-muted)] sm:col-span-2"
              >
                Session <span className="font-normal text-[var(--text-muted)]">({"optional"})</span>
                <input
                  translate="no"
                  id={`${formId}-session`}
                  maxLength={7}
                  pattern="\d{4}-\d{2}"
                  value={session}
                  onChange={(event) => { setSession(event.target.value); }}
                  placeholder="e.g. 2023-24"
                  className="mt-2 min-h-12 w-full rounded-lg border border-[var(--border)] px-3.5 py-3 text-base font-normal outline-none focus-visible:border-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--border)]/20"
                />
              </label>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
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
              disabled={loading || !captchaReady || !captchaToken || !certificateNumber.trim()} aria-busy={loading}
              className="mt-6 min-h-12 w-full rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify Certificate"}
            </button>
          </form>
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
                <div className="sm:col-span-2">
                  <dt className="text-xs text-[var(--text-muted)]">Student</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)] notranslate" translate="no">
                    {result.studentName}
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
