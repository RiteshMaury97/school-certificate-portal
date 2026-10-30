"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import EmptyState from "@/src/components/EmptyState";
import ErrorState from "@/src/components/feedback/ErrorState";
import FeedbackWidget from "@/src/components/FeedbackWidget";
import PublicServiceTabs from "@/src/components/PublicServiceTabs";
import SiteShell from "@/src/components/SiteShell";
import { appCheckHeaders } from "@/src/lib/firebase-client";
import { studentLookupSchema } from "@/src/lib/validation";

import type { StudentResult } from "@/src/types";
import type { FormEvent} from "react";

const formSchema = z.object({
  studentName: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[\p{L}\p{M} .'-]+$/u),
  fatherName: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[\p{L}\p{M} .'-]+$/u),
  motherName: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[\p{L}\p{M} .'-]+$/u),
  session: z.string().regex(/^\d{4}-\d{2}$/),
  consent: z.literal(true),
});
type FormValues = {
  studentName: string;
  fatherName: string;
  motherName: string;
  session: string;
  consent: boolean;
};
type SessionResponse = { sessions: string[] };

function formatDate(value: string | null): string {
  if (!value) return "Not specified";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not specified"
    : new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

export default function FinderPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [form, setForm] = useState<FormValues>({
    studentName: "",
    fatherName: "",
    motherName: "",
    session: "",
    consent: false,
  });
  const [sessions, setSessions] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsLoadError, setSessionsLoadError] = useState(false);
  const [sessionsRetry, setSessionsRetry] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const [captchaRetry, setCaptchaRetry] = useState(0);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const effectiveSiteKey =
    siteKey || (process.env.NODE_ENV === "development" ? "1x00000000000000000000AA" : "");

  const [result, setResult] = useState<StudentResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [disambiguationValue, setDisambiguationValue] = useState("");
  const [error, setError] = useState("");
  const [networkError, setNetworkError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const fieldErrors: Partial<Record<keyof FormValues, string>> = {
    studentName:
      form.studentName.trim().length < 2
        ? "Enter at least 2 characters."
        : !/^[\p{L}\p{M} .'-]+$/u.test(form.studentName)
          ? "Use the name shown in school records."
          : undefined,
    fatherName:
      form.fatherName.trim().length < 2
        ? "Enter at least 2 characters."
        : !/^[\p{L}\p{M} .'-]+$/u.test(form.fatherName)
          ? "Use the name shown in school records."
          : undefined,
    motherName:
      form.motherName.trim().length < 2
        ? "Enter at least 2 characters."
        : !/^[\p{L}\p{M} .'-]+$/u.test(form.motherName)
          ? "Use the name shown in school records."
          : undefined,
    session:
      form.session && !/^\d{4}-\d{2}$/.test(form.session)
        ? "Choose a valid passing session."
        : undefined,
  };
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const formId = useId();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/sessions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load sessions");
        return response.json() as Promise<SessionResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setSessions(data.sessions);
          setSessionsLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSessionsLoadError(true);
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
    const renderWidget = () => {
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
    if (window.turnstile) renderWidget();
    else if (existing) existing.addEventListener("load", renderWidget, { once: true });
    else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      script.onerror = () => { setCaptchaError(true); };
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [effectiveSiteKey, captchaRetry]);

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    if (challengeToken) {
      setChallengeToken("");
      setDisambiguationValue("");
    }
    setForm((current) => ({ ...current, [field]: value }));
  }
  async function downloadAllAsZip() {
    if (!result || zipLoading) return;
    if (result.certificates.length > 20) {
      setError(
        "ZIP downloads support up to 20 certificates at a time. Download the remaining certificates individually.",
      );
      return;
    }
    setZipLoading(true);
    try {
      const ids = result.certificates.map((c) => c.certId).join(",");
      const response = await fetch(
        `/api/certificates/bundle?token=${encodeURIComponent(result.accessToken)}&ids=${encodeURIComponent(ids)}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error("The ZIP could not be prepared. Please search again and retry.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "school-certificates.zip";
      anchor.click();
      window.setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to create the ZIP archive.",
      );
    } finally {
      setZipLoading(false);
    }
  }

  useEffect(() => {
    const shouldNoIndex = Boolean(result || notFound);
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
  }, [result, notFound]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNetworkError(false);
    setResult(null);
    setNotFound(false);
    const parsed = formSchema.safeParse(form);
    if (
      !parsed.success ||
      (!challengeToken && !captchaToken) ||
      (challengeToken && !disambiguationValue.trim())
    ) {
      setTouched({
        studentName: true,
        fatherName: true,
        motherName: true,
        session: true,
      });
      setError("No record found. Check the details and try again.");
      return;
    }
    setLoading(true);
    try {
      const payload = challengeToken
        ? { challengeToken, disambiguationValue: disambiguationValue.trim() }
        : { ...parsed.data, turnstileToken: captchaToken };
      if (!challengeToken && !studentLookupSchema.safeParse(payload).success)
        throw new Error("No record found. Check the details and try again.");
      const response = await fetch("/api/certificates/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data: unknown = await response.json();
      if (!response.ok || typeof data !== "object" || data === null)
        throw new Error("No record found. Check the details and try again.");
      if (
        "needsMoreInfo" in data &&
        data.needsMoreInfo === true &&
        "challengeToken" in data &&
        typeof data.challengeToken === "string"
      ) {
        setChallengeToken(data.challengeToken);
        setDisambiguationValue("");
        setError("");
        setNotFound(false);
      } else if ("found" in data && data.found === false) {
        setNotFound(true);
        setChallengeToken("");
        setDisambiguationValue("");
      } else if ("found" in data && data.found === true) {
        setResult(data as unknown as StudentResult);
        navigate("/certificates/results", { state: { result: data as StudentResult } });
        setChallengeToken("");
        setDisambiguationValue("");
      } else throw new Error("No record found. Check the details and try again.");
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      setCaptchaToken("");
    } catch {
      setNetworkError(true);
      setError("");
      setChallengeToken("");
      setDisambiguationValue("");
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      setCaptchaToken("");
    } finally {
      setLoading(false);
    }
  }

  const printUrl = result
    ? `/api/certificates/print?token=${encodeURIComponent(result.accessToken)}&ids=${encodeURIComponent(result.certificates.map((c) => c.certId).join(","))}`
    : "";

  return (
    <SiteShell>
      <section className="mx-auto max-w-4xl">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--text-muted)]">
          <Link to="/" className="underline">
            Home
          </Link>{" "}
          / Certificates
        </nav>
        <PublicServiceTabs />
        <ol
          aria-label={"How it works"}
          className="mb-5 grid gap-3 rounded-xl border border-[var(--border)] bg-white p-4 sm:grid-cols-3"
        >
          {[
            {
              icon: "edit",
              title: `1. Enter your details`,
              desc: "Use the details in your school records.",
            },
            {
              icon: "shield",
              title: `2. We verify your record`,
              desc: "A secure check matches the school register.",
            },
            {
              icon: "download",
              title: `3. View and download your certificates`,
              desc: "Access your available certificates.",
            },
          ].map((step) => (
            <li key={step.title} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]"
              >
                {step.icon === "edit" ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M12 20h9" />
                    <path d="m16.5 3.5 4 4L8 20l-5 1 1-5Z" />
                  </svg>
                ) : step.icon === "shield" ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6Z" />
                    <path d="m8.5 12 2.2 2.2 4.8-5" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                    <path d="M5 17v3h14v-3" />
                  </svg>
                )}
              </span>
              <span>
                <strong className="block text-sm text-[var(--primary)]">{step.title}</strong>
                <span className="text-xs text-[var(--text-muted)]">{step.desc}</span>
              </span>
            </li>
          ))}
        </ol>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          className="mb-8 rounded-2xl border border-[var(--border)] bg-white px-6 py-8 text-center shadow-[0_2px_12px_rgba(20,30,40,0.03)] sm:px-10 sm:py-10"
        >
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--text-muted)]">
            {"Student services"}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
            {"Access Your School Certificates"}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[var(--text-muted)] sm:text-base">
            {
              "Find and securely view or download certificates issued by the school. Enter your details as recorded in the school register."
            }
          </p>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Downloaded, previewed, printed and ZIP copies receive a light watermark. The original
            school file remains unchanged.
          </p>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.3,
            delay: reduceMotion ? 0 : 0.04,
          }}
          className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[0_2px_12px_rgba(20,30,40,0.03)] sm:p-8"
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[var(--text)]">{"Student verification"}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{"All fields are required."}</p>
          </div>
          <form ref={formRef} onSubmit={submit} noValidate aria-describedby={`${formId}-help`}>
            <div className="grid gap-5 sm:grid-cols-2">
              {(
                [
                  ["studentName", "Student Name", "Enter student's full name"],
                  ["fatherName", "Father’s Name", "Enter father's full name"],
                  ["motherName", "Mother’s Name", "Enter mother's full name"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key}>
                  <label
                    htmlFor={`${formId}-${key}`}
                    className="mb-2 block text-sm font-semibold text-[var(--text-muted)]"
                  >
                    {label}
                    <span aria-hidden="true" className="text-[var(--text)]">
                      {" "}
                      *
                    </span>
                  </label>
                  <input
                    translate="no"
                    id={`${formId}-${key}`}
                    name={key}
                    autoComplete="off"
                    required
                    maxLength={100}
                    value={form[key]}
                    aria-invalid={Boolean(touched[key] && fieldErrors[key])}
                    aria-describedby={`${formId}-${key}-help ${formId}-${key}-error`}
                    onBlur={() => { setTouched((v) => ({ ...v, [key]: true })); }}
                    onChange={(event) => { update(key, event.target.value); }}
                    placeholder={placeholder}
                    className="min-h-12 w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-3 text-base text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--border)] focus-visible:border-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--border)]/20"
                  />
                  <p
                    id={`${formId}-${key}-help`}
                    className="mt-1.5 text-xs text-[var(--text-muted)]"
                  >
                    {"Enter the name exactly as in school records. Example: Rahul Kumar."}
                  </p>
                  <p
                    id={`${formId}-${key}-error`}
                    className="mt-1 text-xs text-red-700"
                    aria-live="polite"
                  >
                    {touched[key] ? (fieldErrors[key] ?? "") : ""}
                  </p>
                </div>
              ))}
              <div>
                <label
                  htmlFor={`${formId}-session`}
                  className="mb-2 block text-sm font-semibold text-[var(--text-muted)]"
                >
                  {"Session of Passing"}
                  <span aria-hidden="true" className="text-[var(--text)]">
                    {" "}
                    *
                  </span>
                </label>
                <select
                  translate="no"
                  id={`${formId}-session`}
                  name="session"
                  required
                  value={form.session}
                  aria-invalid={Boolean(sessions.length > 0 && touched.session && !form.session)}
                  aria-describedby={`${formId}-session-help ${formId}-session-error`}
                  onBlur={() => { setTouched((v) => ({ ...v, session: true })); }}
                  onChange={(event) => { update("session", event.target.value); }}
                  disabled={sessionsLoading || sessionsLoadError || sessions.length === 0}
                  className="min-h-12 w-full rounded-lg border border-[var(--border)] bg-white px-3.5 py-3 text-base text-[var(--text)] outline-none transition focus-visible:border-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--border)]/20 disabled:cursor-not-allowed disabled:bg-[var(--border)]"
                >
                  {sessions.length === 0 ? (
                    <option value="">
                      {sessionsLoading ? "Loading sessions…" : "No data found"}
                    </option>
                  ) : (
                    <option value="">Select passing session</option>
                  )}
                  {sessions.map((session) => (
                    <option key={session} value={session}>
                      {session}
                    </option>
                  ))}
                </select>
                <p
                  id={`${formId}-session-help`}
                  className="mt-1.5 text-xs text-[var(--text-muted)]"
                >
                  {"Session in which you passed, e.g. 2023-24."}
                </p>
                <p
                  id={`${formId}-session-error`}
                  className="mt-1 text-xs text-red-700"
                  aria-live="polite"
                >
                  {sessions.length > 0 && touched.session && !form.session
                    ? "Select your passing session."
                    : ""}
                </p>
                {!sessionsLoading && sessions.length === 0 && !sessionsLoadError && (
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]" role="status">
                    No published sessions are currently available. Please contact the school office.
                  </p>
                )}
                {sessionsLoadError && (
                  <div className="mt-2">
                    <ErrorState
                      title="Sessions could not be loaded"
                      description="Check your connection and retry. This is a loading error, not an empty session list."
                      onRetry={() => {
                        setSessionsLoadError(false);
                        setSessionsLoading(true);
                        setSessionsRetry((value) => value + 1);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            <p id={`${formId}-help`} className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
              Use the name spelling and passing session shown in your school records.
            </p>

            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--primary)] p-4">
              <p className="mb-3 text-sm leading-6 text-[var(--text-muted)]">
                "Many records belong to students under 18. If the student is a minor, a parent or
                guardian should use this portal or be present. The school processes this data only
                to provide certificates. "
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  "See our Privacy Policy"
                </Link>
              </p>
              <p className="mb-3 text-sm leading-6 text-[var(--text-muted)]">
                Privacy notice: We use the student's name, parents' names and passing session only
                to verify and retrieve the matching school certificate. The matching certificate
                file and limited certificate details are stored securely by the school. We do not
                use these details for advertising or student profiling. You may withdraw consent or
                request access, correction or erasure through the{" "}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  Privacy page
                </Link>
                .
              </p>
              <p className="mb-3 text-sm leading-6 text-[var(--text-muted)]">
                Students may be minors. A parent or legal guardian must be involved and confirm they
                are authorized to make this request. The school uses its verified school records to
                process certificate retrieval.
              </p>
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[var(--text-muted)]">
                <input
                  translate="no"
                  type="checkbox"
                  checked={form.consent}
                  onChange={(event) => { update("consent", event.target.checked); }}
                  required
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
                />
                <span>
                  I am the student, or the parent/guardian of the student. I freely and specifically
                  consent to the use of these details for certificate retrieval, and confirm
                  parent/guardian involvement where the student is a child. I have read the{" "}
                  <Link
                    to="/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--text)] underline underline-offset-2 hover:text-black"
                  >
                    Privacy Notice
                  </Link>
                  .
                </span>
              </label>
            </div>

            {challengeToken && (
              <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--primary)] p-4">
                <label
                  htmlFor={`${formId}-disambiguation`}
                  className="block text-sm font-semibold text-[var(--primary)]"
                >
                  {"Date of Birth or Admission Number (needed to confirm your identity)"}
                </label>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {
                    "Enter your date of birth as DD-MM-YYYY or the admission number recorded by the school."
                  }
                </p>
                <input
                  translate="no"
                  id={`${formId}-disambiguation`}
                  autoComplete="off"
                  value={disambiguationValue}
                  onChange={(event) => { setDisambiguationValue(event.target.value); }}
                  className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  required
                  aria-describedby={`${formId}-disambiguation-help`}
                />
                <span id={`${formId}-disambiguation-help`} className="sr-only">
                  This information is used only to confirm the correct student record.
                </span>
              </div>
            )}
            <div className={challengeToken ? "hidden" : "mt-5"}>
              <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
                Security verification
                <span aria-hidden="true" className="text-[var(--danger)]">
                  {" "}
                  *
                </span>
              </p>
              <div
                ref={captchaRef}
                className="min-h-[66px]"
                aria-label="Cloudflare security verification"
              />
              {!captchaReady && !captchaError && (
                <p className="text-xs text-[var(--text-muted)]" role="status">
                  {"Loading security verification…"}
                </p>
              )}
              {captchaError && (
                <div className="mt-2">
                  <ErrorState
                    title="Security check could not load"
                    description="The security verification service is unavailable. The form remains disabled until it loads successfully."
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
                sessionsLoading ||
                sessions.length === 0 ||
                !form.consent ||
                (challengeToken ? !disambiguationValue.trim() : !captchaToken || !captchaReady)
              }
              className="mt-6 min-h-12 w-full rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-[var(--primary-contrast)] transition hover:bg-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Searching records…" : "Find My Certificates"}
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-[var(--text-muted)]">
              Your information is used only to verify and retrieve the relevant school records.
            </p>
          </form>
        </motion.div>

        {loading && (
          <section
            aria-label="Searching for certificates"
            aria-live="polite"
            className="mt-7 space-y-3"
          >
            <div className="h-6 w-48 animate-pulse rounded bg-[var(--primary)]" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-xl border border-[var(--border)] bg-white p-5"
                >
                  <div className="h-4 w-2/3 rounded bg-[var(--primary)]" />
                  <div className="mt-5 h-3 w-1/2 rounded bg-[var(--primary)]" />
                  <div className="mt-3 h-3 w-1/3 rounded bg-[var(--primary)]" />
                </div>
              ))}
            </div>
          </section>
        )}
        {notFound && !loading && (
          <div className="mt-6">
            <EmptyState title="No record found. Check the details and try again." />
          </div>
        )}
        {networkError && !loading && (
          <div className="mt-6">
            <ErrorState
              title="Certificate search unavailable"
              description="We could not reach the certificate service. Check your connection and retry."
              onRetry={() => {
                setNetworkError(false);
                formRef.current?.requestSubmit();
              }}
            />
          </div>
        )}
        {error && !loading && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--primary)] p-4 text-sm font-medium text-[var(--text)]"
          >
            {error}
          </div>
        )}
        {result && !loading && (
          <section
            aria-live="polite"
            translate="no"
            className="notranslate mt-8"
            id="certificate-results"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--text-muted)]">
                  {"Search results"}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--text)]">
                  {"Your certificates"}
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {result.studentName} · Passing session {result.session}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                  {result.certificates.length} {"found"}
                </span>
                <button
                  type="button"
                  onClick={downloadAllAsZip}
                  disabled={zipLoading || result.certificates.length === 0}
                  className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-contrast)] disabled:opacity-50"
                >
                  {zipLoading ? "Preparing ZIP…" : "Download all (ZIP)"}
                </button>
                <a
                  href={printUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]"
                >
                  {"Print all"}
                </a>
              </div>
            </div>
            {result.certificates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-5 py-10 text-center">
                <p className="font-semibold text-[var(--text-muted)]">
                  No record found. Check the details and try again.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {result.certificates.map((certificate) => (
                  <article
                    key={certificate.certId}
                    className="flex flex-col rounded-xl border border-[var(--border)] bg-white p-5 shadow-[0_2px_10px_rgba(20,30,40,0.025)] print:break-inside-avoid print:border-[var(--border)] print:shadow-none"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        aria-hidden="true"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--text)]"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path d="M7 3.75h7l4 4v12.5H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z" />
                          <path d="M14 3.75v4h4M8.5 13h7M8.5 16.5h7" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold leading-5 text-[var(--text)]">
                          {certificate.title}
                        </h3>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{certificate.type}</p>
                      </div>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                      <div>
                        <dt className="text-xs text-[var(--text-muted)]">{"Session"}</dt>
                        <dd className="mt-0.5 font-semibold text-[var(--text-muted)]">
                          {certificate.session}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--text-muted)]">{"Issue date"}</dt>
                        <dd className="mt-0.5 font-semibold text-[var(--text-muted)]">
                          {formatDate(certificate.issueDate)}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-xs text-[var(--text-muted)]">{"Certificate number"}</dt>
                        <dd className="mt-0.5 break-all font-semibold text-[var(--text-muted)]">
                          {certificate.certificateNumber}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      <a
                        href={`/api/certificates/${encodeURIComponent(certificate.certId)}/file?token=${encodeURIComponent(result.accessToken)}&mode=view`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
                      >
                        {"View"}
                      </a>
                      <a
                        href={`/api/certificates/${encodeURIComponent(certificate.certId)}/file?token=${encodeURIComponent(result.accessToken)}`}
                        className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-contrast)] transition hover:bg-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border)]"
                      >
                        {"Download"}
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {result && !loading && <FeedbackWidget />}
      </section>
    </SiteShell>
  );
}
