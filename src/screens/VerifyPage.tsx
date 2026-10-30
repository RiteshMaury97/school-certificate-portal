"use client";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import SiteShell from "@/src/components/SiteShell";
import PublicServiceTabs from "@/src/components/PublicServiceTabs";
import { appCheckHeaders } from "@/src/lib/firebase-client";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [certificateNumber, setCertificateNumber] = useState("");
  const [session, setSession] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<Verification | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const formId = useId();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    if (!siteKey || !captchaRef.current) {
      setCaptchaError(true);
      return;
    }
    let cancelled = false;
    const scriptId = "cloudflare-turnstile-script";
    const existing = document.getElementById(
      scriptId,
    ) as HTMLScriptElement | null;
    const render = () => {
      if (
        cancelled ||
        !captchaRef.current ||
        !window.turnstile ||
        widgetId.current
      )
        return;
      try {
        widgetId.current = window.turnstile.render(captchaRef.current, {
          sitekey: siteKey,
          appearance: "always",
          callback: (token) => {
            setCaptchaToken(token);
            setCaptchaError(false);
          },
          "expired-callback": () => setCaptchaToken(""),
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
    else if (existing)
      existing.addEventListener("load", render, { once: true });
    else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => setCaptchaError(true);
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile)
        window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

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
    setResult(null);
    if (
      !certificateNumber.trim() ||
      certificateNumber.trim().length > 80 ||
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
          ...(session.trim() ? { session: session.trim() } : {}),
          turnstileToken: captchaToken,
        }),
        cache: "no-store",
      });
      const data: unknown = await response.json();
      if (!response.ok || typeof data !== "object" || data === null)
        throw new Error("verification");
      if ("valid" in data && data.valid === true)
        setResult(data as Verification);
      else if (
        "status" in data &&
        (data.status === "superseded" || data.status === "revoked")
      )
        setResult(data as Verification);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setCaptchaToken("");
      if (widgetId.current && window.turnstile)
        window.turnstile.reset(widgetId.current);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-4xl">
        <PublicServiceTabs />
        <div className="mb-8 rounded-2xl border border-[#dfe3e7] bg-white px-6 py-8 text-center shadow-[0_2px_12px_rgba(20,30,40,0.03)] sm:px-10 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#697582]">
            {t("publicService")}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#20252b] sm:text-4xl">
            {t("verifyTitle")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#626c76] sm:text-base">
            Check whether a certificate number matches a certificate issued by
            the school. Verification does not reveal or provide access to the
            original document.
          </p>
        </div>
        <div className="rounded-2xl border border-[#dfe3e7] bg-white p-5 shadow-[0_2px_12px_rgba(20,30,40,0.03)] sm:p-8">
          <form onSubmit={submit} noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <label
                htmlFor={`${formId}-number`}
                className="text-sm font-semibold text-[#35414c] sm:col-span-2"
              >
                {t("certificateNumber")}
                <input
                  id={`${formId}-number`}
                  required
                  maxLength={80}
                  autoComplete="off"
                  value={certificateNumber}
                  onChange={(event) => setCertificateNumber(event.target.value)}
                  placeholder="Enter the certificate number"
                  className="mt-2 min-h-12 w-full rounded-lg border border-[#cbd2d9] px-3.5 py-3 text-base font-normal outline-none focus-visible:border-[#354f68] focus-visible:ring-2 focus-visible:ring-[#354f68]/20"
                />
              </label>
              <label
                htmlFor={`${formId}-session`}
                className="text-sm font-semibold text-[#35414c] sm:col-span-2"
              >
                Session{" "}
                <span className="font-normal text-[#697582]">
                  ({t("optional")})
                </span>
                <input
                  id={`${formId}-session`}
                  maxLength={7}
                  pattern="\d{4}-\d{2}"
                  value={session}
                  onChange={(event) => setSession(event.target.value)}
                  placeholder="e.g. 2023-24"
                  className="mt-2 min-h-12 w-full rounded-lg border border-[#cbd2d9] px-3.5 py-3 text-base font-normal outline-none focus-visible:border-[#354f68] focus-visible:ring-2 focus-visible:ring-[#354f68]/20"
                />
              </label>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-[#35414c]">
                {t("securityCheck")}
              </p>
              <div
                ref={captchaRef}
                className="min-h-[66px]"
                aria-label="Cloudflare security verification"
              />
              {!captchaReady && !captchaError && (
                <p className="text-xs text-[#697582]" role="status">
                  Loading security verification…
                </p>
              )}
              {captchaError && (
                <p className="text-xs text-[#a13a32]" role="alert">
                  Security verification is unavailable. Please refresh and try
                  again.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={
                loading ||
                !captchaReady ||
                !captchaToken ||
                !certificateNumber.trim()
              }
              className="mt-6 min-h-12 w-full rounded-lg bg-[#263746] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#182936] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t("verifying") : t("verifyButton")}
            </button>
          </form>
        </div>
        {failed && !loading && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 rounded-xl border border-[#dfe3e7] bg-white p-5 text-sm font-semibold text-[#53606c]"
          >
            {genericFailure}
          </div>
        )}
        {result && !loading && (
          <section
            aria-live="polite"
            className={`mt-6 rounded-2xl border bg-white p-6 shadow-sm ${result.valid ? "border-emerald-200" : "border-amber-300"}`}
          >
            <h2 className="mt-2 text-2xl font-bold text-[#20252b]">
              {result.message}
            </h2>
            {!result.valid && result.status === "superseded" && (
              <p className="mt-4 text-sm text-[#26323d]">
                New certificate number:{" "}
                <strong>{result.newCertificateNumber}</strong>
              </p>
            )}
            {result.valid && (
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[#697582]">Certificate type</dt>
                  <dd className="mt-1 font-semibold text-[#26323d]">
                    {result.certificateType}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#697582]">Session</dt>
                  <dd className="mt-1 font-semibold text-[#26323d]">
                    {result.session}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#697582]">Issue date</dt>
                  <dd className="mt-1 font-semibold text-[#26323d]">
                    {displayDate(result.issueDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[#697582]">School</dt>
                  <dd className="mt-1 font-semibold text-[#26323d]">
                    {result.schoolName}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-[#697582]">Student</dt>
                  <dd className="mt-1 font-semibold text-[#26323d]">
                    {result.studentName}
                  </dd>
                </div>
              </dl>
            )}
            {result.valid && (
              <p className="mt-5 border-t border-[#e6e9ec] pt-4 text-xs text-[#697582]">
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
