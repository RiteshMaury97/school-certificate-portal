"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";

import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import SiteShell from "@/components/layout/SiteShell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useCertificateFlow } from "@/features/certificates/CertificateFlowProvider";
import { appCheckHeaders } from "@/lib/firebase-client";
import { studentLookupSchema } from "@/shared/validation";

import type { SubmitEvent } from "react";
import type { StudentResult } from "@/types";

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
  className: z.string().trim().min(1).max(40),
  scholarNumber: z.string().trim().min(1).max(40),
  session: z.string().regex(/^\d{4}-\d{2}$/),
  consent: z.literal(true),
});
type FormValues = {
  studentName: string;
  fatherName: string;
  motherName: string;
  className: string;
  scholarNumber: string;
  session: string;
  consent: boolean;
};
type SessionResponse = { sessions: string[] };

export default function FinderPage() {
  const router = useRouter();
  const { setResult: shareResult } = useCertificateFlow();
  const reduceMotion = useReducedMotion();
  const [form, setForm] = useState<FormValues>({
    studentName: "",
    fatherName: "",
    motherName: "",
    className: "",
    scholarNumber: "",
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
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({});
  const fieldErrors: Partial<Record<keyof FormValues, string | undefined>> = {
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
    className: !form.className.trim()
      ? "Enter the class shown in school records."
      : form.className.length > 40 || !/^[\p{L}\p{M}\p{N} ./'-]+$/u.test(form.className)
        ? "Use the class or section shown in school records."
        : undefined,
    scholarNumber: !form.scholarNumber.trim()
      ? "Enter the scholar number shown in school records."
      : form.scholarNumber.length > 40 || !/^[\p{L}\p{M}\p{N} /-]+$/u.test(form.scholarNumber)
        ? "Use the scholar number shown in school records."
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
    if (window.turnstile) renderWidget();
    else if (existing) existing.addEventListener("load", renderWidget, { once: true });
    else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
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

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    if (challengeToken) {
      setChallengeToken("");
      setDisambiguationValue("");
    }
    setForm((current) => ({ ...current, [field]: value }));
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

  async function submit(event: SubmitEvent<HTMLFormElement>) {
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
        className: true,
        scholarNumber: true,
        session: true,
      });
      setError("No record found. Check the details and try again.");
      return;
    }
    setLoading(true);
    let navigatingToResults = false;
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
        shareResult(data as unknown as StudentResult);
        navigatingToResults = true;
        router.push("/certificates/results");
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
      if (!navigatingToResults) setLoading(false);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Certificates</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
            className="order-1 mb-5 overflow-hidden rounded-3xl bg-[var(--primary)] px-6 py-8 text-[var(--on-primary)] shadow-[var(--shadow-card)] sm:px-9 sm:py-10"
          >
            <div className="grid items-center gap-7 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--on-primary)_75%,transparent)]">
                  Student services / Certificates
                </p>
                <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                  Your school records,
                  <br className="hidden sm:block" /> all in one place.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[color-mix(in_srgb,var(--on-primary)_82%,transparent)]">
                  Verify your details to securely view and download official school certificates.
                </p>
                <p className="mt-3 text-xs text-[color-mix(in_srgb,var(--on-primary)_70%,transparent)]">
                  Downloaded, previewed and printed copies include a light watermark. The original
                  school file remains unchanged.
                </p>
              </div>
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--on-primary)_12%,transparent)] bg-[color-mix(in_srgb,var(--on-primary)_8%,transparent)] p-4">
                <div className="rounded-xl bg-[var(--surface)] p-4 text-[var(--text)]">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--primary)]">
                    Official certificate
                  </p>
                  <p className="mt-2 text-sm font-semibold">Academic record</p>
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                    Verified student document
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] font-semibold text-[var(--primary)]">
                    <ShieldCheck size={12} aria-hidden="true" /> Secure access
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
          <ol
            aria-label={"How it works"}
            className="order-2 mb-5 grid gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:grid-cols-3 sm:p-5"
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
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]"
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
                  <strong className="block text-xs font-semibold text-[var(--text)]">
                    {step.title}
                  </strong>
                  <span className="mt-0.5 block text-[10px] leading-4 text-[var(--text-muted)]">
                    {step.desc}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.3,
            delay: reduceMotion ? 0 : 0.04,
          }}
          className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(250px,.8fr)]"
        >
          <div className="min-w-0 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
            <div className="mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                Secure certificate lookup
              </p>
              <h2 className="mt-1 text-xl font-bold text-[var(--text)]">
                Let’s verify your student record
              </h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Enter your details exactly as they appear in your school records.
              </p>
            </div>
            <form ref={formRef} onSubmit={submit} noValidate aria-describedby={`${formId}-help`}>
              <div className="grid gap-5 sm:grid-cols-2">
                {(
                  [
                    ["studentName", "Student Name", "Enter student's full name"],
                    ["fatherName", "Father’s Name", "Enter father's full name"],
                    ["motherName", "Mother’s Name", "Enter mother's full name"],
                    ["className", "Class", "e.g. Class 10"],
                    ["scholarNumber", "Scholar Number", "Enter scholar number"],
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
                      maxLength={key === "className" || key === "scholarNumber" ? 40 : 100}
                      value={form[key]}
                      aria-invalid={Boolean(touched[key] && fieldErrors[key])}
                      aria-describedby={`${formId}-${key}-help ${formId}-${key}-error`}
                      onBlur={() => {
                        setTouched((v) => ({ ...v, [key]: true }));
                      }}
                      onChange={(event) => {
                        update(key, event.target.value);
                      }}
                      placeholder={placeholder}
                      className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition placeholder:text-[var(--text-muted)] focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                    />
                    <p
                      id={`${formId}-${key}-help`}
                      className="mt-1.5 text-xs text-[var(--text-muted)]"
                    >
                      {"Enter the name exactly as in school records. Example: Rahul Kumar."}
                    </p>
                    <p
                      id={`${formId}-${key}-error`}
                      className="mt-1 text-xs text-[var(--danger)]"
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
                  {sessionsLoading ? (
                    <div
                      role="status"
                      aria-label="Loading sessions"
                      className="skeleton min-h-12 w-full border border-[var(--divider)]"
                    />
                  ) : (
                    <select
                      translate="no"
                      id={`${formId}-session`}
                      name="session"
                      required
                      value={form.session}
                      aria-invalid={Boolean(
                        sessions.length > 0 && touched.session && !form.session,
                      )}
                      aria-describedby={`${formId}-session-help ${formId}-session-error`}
                      onBlur={() => {
                        setTouched((v) => ({ ...v, session: true }));
                      }}
                      onChange={(event) => {
                        update("session", event.target.value);
                      }}
                      disabled={sessionsLoading || sessionsLoadError || sessions.length === 0}
                      className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition focus-visible:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)]"
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
                  )}
                  <p
                    id={`${formId}-session-help`}
                    className="mt-1.5 text-xs text-[var(--text-muted)]"
                  >
                    {"Session in which you passed, e.g. 2023-24."}
                  </p>
                  <p
                    id={`${formId}-session-error`}
                    className="mt-1 text-xs text-[var(--danger)]"
                    aria-live="polite"
                  >
                    {sessions.length > 0 && touched.session && !form.session
                      ? "Select your passing session."
                      : ""}
                  </p>
                  {!sessionsLoading && sessions.length === 0 && !sessionsLoadError && (
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]" role="status">
                      No active academic sessions are available. Please contact the school office.
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
                Use the name spelling, class, scholar number and passing session shown in your
                school records.
              </p>

              <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <p className="mb-3 text-sm leading-6 text-[var(--text-muted)]">
                  "Many records belong to students under 18. If the student is a minor, a parent or
                  guardian should use this portal or be present. The school processes this data only
                  to provide certificates. "
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    "See our Privacy Policy"
                  </Link>
                </p>
                <p className="mb-3 text-sm leading-6 text-[var(--text-muted)]">
                  Privacy notice: We use the student's name, parents' names, class, scholar number
                  and passing session only to verify and retrieve the matching school certificate.
                  The matching certificate file and limited certificate details are stored securely
                  by the school. We do not use these details for advertising or student profiling.
                  You may withdraw consent or request access, correction or erasure through the{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline"
                  >
                    Privacy page
                  </Link>
                  .
                </p>
                <p className="mb-3 text-sm leading-6 text-[var(--text-muted)]">
                  Students may be minors. A parent or legal guardian must be involved and confirm
                  they are authorized to make this request. The school uses its verified school
                  records to process certificate retrieval.
                </p>
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[var(--text-muted)]">
                  <input
                    translate="no"
                    type="checkbox"
                    checked={form.consent}
                    onChange={(event) => {
                      update("consent", event.target.checked);
                    }}
                    required
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                  />
                  <span>
                    I am the student, or the parent/guardian of the student. I freely and
                    specifically consent to the use of these details for certificate retrieval, and
                    confirm parent/guardian involvement where the student is a child. I have read
                    the{" "}
                    <Link
                      href="/privacy"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--text)] underline underline-offset-2 hover:text-[var(--text)]"
                    >
                      Privacy Notice
                    </Link>
                    .
                  </span>
                </label>
              </div>

              {challengeToken && (
                <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <label
                    htmlFor={`${formId}-disambiguation`}
                    className="block text-sm font-semibold text-[var(--text)]"
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
                    onChange={(event) => {
                      setDisambiguationValue(event.target.value);
                    }}
                    className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
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
                aria-busy={loading}
                className="mt-6 min-h-12 w-full rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-bold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-90"
                        fill="currentColor"
                        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
                      />
                    </svg>
                    Searching records…
                  </span>
                ) : (
                  "Find My Certificates"
                )}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-[var(--text-muted)]">
                Your information is used only to verify and retrieve the relevant school records.
              </p>
            </form>
          </div>
          <aside className="h-fit rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-sm font-bold text-[var(--text)]">What happens next</h2>
            <ol className="mt-4 space-y-4">
              {[
                [
                  "01",
                  "We match your record",
                  "Your details are checked against the school register.",
                ],
                ["02", "You review documents", "See available certificates before downloading."],
                ["03", "Download securely", "Get a print-ready PDF with a digital watermark."],
              ].map(([number, title, description]) => (
                <li key={number} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] font-bold text-[var(--primary)]">
                    {number}
                  </span>
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text)]">{title}</h3>
                    <p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 rounded-xl bg-[var(--surface-2)] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
                <ShieldCheck size={15} aria-hidden="true" className="text-[var(--primary)]" /> Your
                information is protected
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">
                We use your details only to locate and verify the matching school certificate. Your
                information is not used for advertising or profiling.
              </p>
              <Link
                href="/privacy"
                className="mt-3 inline-flex items-center text-[10px] font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                Read the privacy notice
              </Link>
            </div>
          </aside>
        </motion.div>

        {loading && (
          <section
            aria-label="Searching for certificates"
            aria-live="polite"
            className="mt-7 space-y-3"
          >
            <div className="flex items-center gap-3" role="status">
              <svg
                className="h-5 w-5 animate-spin text-[var(--primary)]"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
                />
              </svg>
              <span className="text-sm font-semibold text-[var(--text-muted)]">
                Searching the school records…
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
                >
                  <div className="h-4 w-2/3 rounded bg-[var(--surface-2)]" />
                  <div className="mt-5 h-3 w-1/2 rounded bg-[var(--surface-2)]" />
                  <div className="mt-3 h-3 w-1/3 rounded bg-[var(--surface-2)]" />
                </div>
              ))}
            </div>
          </section>
        )}
        {notFound && !loading && (
          <div className="mt-6">
            <EmptyState
              title="No matching certificate was found"
              description="Check that the student’s name, both parent names, and passing session match the school record exactly. Only approved and published certificates appear here. If the details are correct, contact the school office to check the record or publication status."
            />
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
            className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm font-medium text-[var(--text)]"
          >
            {error}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
