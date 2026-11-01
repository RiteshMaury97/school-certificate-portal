"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

import type { SubmitEvent } from "react";

type SessionsResponse = { sessions: string[] };

export default function ReportWrongRecordModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [session, setSession] = useState("");
  const [sessions, setSessions] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [sessionsRetry, setSessionsRetry] = useState(0);
  const [issue, setIssue] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [captchaError, setCaptchaError] = useState(false);
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  useEffect(() => {
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const first = dialog?.querySelector<HTMLElement>("button,input,textarea");
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialog) {
        const nodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,[href],[tabindex]:not([tabindex='-1'])",
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        const firstNode = nodes[0],
          lastNode = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === firstNode) {
          event.preventDefault();
          lastNode?.focus();
        } else if (!event.shiftKey && document.activeElement === lastNode) {
          event.preventDefault();
          firstNode?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/sessions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Sessions unavailable");
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
    if (!siteKey || !captcha.current) {
      setCaptchaError(true);
      return;
    }
    let cancelled = false;
    const render = () => {
      if (cancelled || !captcha.current || !window.turnstile || widget.current) return;
      try {
        widget.current = window.turnstile.render(captcha.current, {
          sitekey: siteKey,
          callback: (value) => {
            setToken(value);
            setCaptchaError(false);
          },
          "expired-callback": () => {
            setToken("");
          },
          "error-callback": () => {
            setToken("");
            setCaptchaError(true);
          },
        });
      } catch {
        setCaptchaError(true);
      }
    };
    const id = "cloudflare-turnstile-script";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (window.turnstile) render();
    else if (existing) existing.addEventListener("load", render, { once: true });
    else {
      const script = document.createElement("script");
      script.id = id;
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
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const trimmedIssue = issue.trim();
    const trimmedEmail = contactEmail.trim();
    const nextFieldErrors: Record<string, string> = {};
    if (trimmedName.length < 2)
      nextFieldErrors.name = "Enter the student's name (at least 2 characters).";
    else if (trimmedName.length > 100)
      nextFieldErrors.name = "Student name must be 100 characters or fewer.";
    if (trimmedIssue.length < 10)
      nextFieldErrors.issue = "Describe what is wrong in at least 10 characters.";
    else if (trimmedIssue.length > 2000)
      nextFieldErrors.issue = "Description must be 2,000 characters or fewer.";
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextFieldErrors.contactEmail =
        "Enter a valid email address, such as name@example.com, or leave it blank.";
    }
    const phoneDigits = phoneNumber.replace(/\D/g, "");
    if (
      !/^\+?[0-9\s().-]{8,24}$/.test(phoneNumber.trim()) ||
      phoneDigits.length < 8 ||
      phoneDigits.length > 15
    ) {
      nextFieldErrors.phoneNumber = "Enter a valid phone number with 8–15 digits.";
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Please correct the highlighted fields.");
      return;
    }
    if (!consent || !token) {
      setError("Please provide consent and complete security verification.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/public/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({
          name: trimmedName,
          session,
          issue: trimmedIssue,
          contactEmail: trimmedEmail,
          phoneNumber,
          consent,
          turnstileToken: token,
        }),
        cache: "no-store",
      });
      const data = (await response.json()) as {
        referenceId?: string;
        error?: string;
      };
      if (!response.ok || !data.referenceId) {
        if (data.error?.toLowerCase().includes("security verification")) {
          setToken("");
          setError(
            "Security verification expired or could not be confirmed. Complete the check again, then submit.",
          );
          if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
          return;
        }
        throw new Error(data.error ?? "Unable to submit your report.");
      }
      setReference(data.referenceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit your report.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[var(--scrim)] p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--text)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="report-title" className="text-xl font-bold">
              {"Report a wrong record"}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {"Share only the details needed to identify and review the issue."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={"Close"}
            className="rounded p-2 text-xl"
          >
            ×
          </button>
        </div>
        {reference ? (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
            <h3 className="font-bold text-[var(--text)]">{"Report submitted"}</h3>
            <p className="mt-2 text-sm text-[var(--text)]">{"Your reference ID is:"}</p>
            <p className="mt-1 break-all text-xl font-bold tracking-wide text-[var(--text)]">
              {reference}
            </p>
            <p className="mt-2 text-xs text-[var(--text)]">
              {"Keep this ID for future communication with the school."}
            </p>
            <Link
              href="/report-status"
              className="mt-3 inline-block text-sm font-semibold text-[var(--primary)] underline"
            >
              Check report status
            </Link>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
            >
              {"Close"}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--text)]">
              "Many records belong to students under 18. If the student is a minor, a parent or
              guardian should use this portal or be present. The school processes this data only to
              provide certificates. "
              <Link
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                "See our Privacy Policy"
              </Link>
            </p>
            <label className="block text-sm font-semibold">
              {"Student name"}{" "}
              <span aria-hidden="true" className="text-[var(--danger)]">
                *
              </span>
              <input
                translate="no"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFieldErrors((current) => ({ ...current, name: "" }));
                }}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder={"Name as in school records"}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "report-name-error" : undefined}
              />
              {fieldErrors.name && (
                <span
                  id="report-name-error"
                  role="alert"
                  className="mt-1 block text-xs font-normal text-[var(--danger)]"
                >
                  {fieldErrors.name}
                </span>
              )}
            </label>
            <label className="block text-sm font-semibold">
              Passing session{" "}
              <span aria-hidden="true" className="text-[var(--danger)]">
                *
              </span>
              <select
                translate="no"
                required
                value={session}
                onChange={(e) => {
                  setSession(e.target.value);
                }}
                disabled={sessionsLoading || sessionsError || sessions.length === 0 || busy}
                className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {sessionsLoading ? "Loading active sessions…" : "Choose passing session"}
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
            <label className="block text-sm font-semibold">
              {"What is wrong?"}{" "}
              <span aria-hidden="true" className="text-[var(--danger)]">
                *
              </span>
              <textarea
                translate="no"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={issue}
                onChange={(e) => {
                  setIssue(e.target.value);
                  setFieldErrors((current) => ({ ...current, issue: "" }));
                }}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder={"Describe the incorrect detail or certificate issue"}
                aria-invalid={Boolean(fieldErrors.issue)}
                aria-describedby={fieldErrors.issue ? "report-issue-error" : undefined}
              />
              {fieldErrors.issue && (
                <span
                  id="report-issue-error"
                  role="alert"
                  className="mt-1 block text-xs font-normal text-[var(--danger)]"
                >
                  {fieldErrors.issue}
                </span>
              )}
            </label>
            <label className="block text-sm font-semibold">
              Contact email <span className="font-normal text-[var(--text-muted)]">(optional)</span>
              <input
                translate="no"
                type="email"
                maxLength={254}
                autoComplete="email"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  setFieldErrors((current) => ({ ...current, contactEmail: "" }));
                }}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder="name@example.com"
                aria-invalid={Boolean(fieldErrors.contactEmail)}
                aria-describedby={fieldErrors.contactEmail ? "report-email-error" : undefined}
              />
              {fieldErrors.contactEmail && (
                <span
                  id="report-email-error"
                  role="alert"
                  className="mt-1 block text-xs font-normal text-[var(--danger)]"
                >
                  {fieldErrors.contactEmail}
                </span>
              )}
            </label>
            <label className="block text-sm font-semibold">
              Phone number{" "}
              <span aria-hidden="true" className="text-[var(--danger)]">
                *
              </span>
              <input
                translate="no"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                minLength={8}
                maxLength={24}
                pattern="\+?[0-9\s().-]{8,24}"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setFieldErrors((current) => ({ ...current, phoneNumber: "" }));
                }}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder="+91 98765 43210"
                aria-describedby="report-phone-help"
              />
              {fieldErrors.phoneNumber && (
                <span role="alert" className="mt-1 block text-xs font-normal text-[var(--danger)]">
                  {fieldErrors.phoneNumber}
                </span>
              )}
              <span
                id="report-phone-help"
                className="mt-1 block text-xs font-normal text-[var(--text-muted)]"
              >
                Enter 8–15 digits; spaces, +, parentheses, dots and hyphens are allowed.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm leading-5">
              <input
                translate="no"
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                }}
                className="mt-1"
              />
              <span>
                "I am the student, or the parent/guardian of the student. I confirm that the School
                may use these details to review this report." (
                {
                  "I consent to the school using these details to investigate and respond to this report. I confirm the information is accurate to the best of my knowledge."
                }
                )
              </span>
            </label>
            <div
              ref={captcha}
              className="min-h-16"
              aria-label="Cloudflare Turnstile security check"
            />
            {captchaError ? (
              <p role="alert" className="text-xs text-[var(--danger)]">
                {"Security verification is unavailable. Please refresh the page and try again."}
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                {"Security verification is required to reduce spam and abuse."}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
            <button
              disabled={
                busy ||
                !token ||
                !consent ||
                !session ||
                sessionsLoading ||
                sessionsError ||
                sessions.length === 0
              }
              aria-busy={busy}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-bold text-[var(--on-primary)] disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit report"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
