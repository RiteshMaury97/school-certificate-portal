"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

import type { SubmitEvent } from "react";

function validPhone(value: string): boolean {
  const normalized = value.trim();
  const digits = normalized.replace(/\D/g, "");
  return /^[+\d().\s-]+$/.test(normalized) && digits.length >= 8 && digits.length <= 15;
}

export default function ReportWrongRecordModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [session, setSession] = useState("");
  const [sessions, setSessions] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [issue, setIssue] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [phoneOptIn, setPhoneOptIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [emailCopySent, setEmailCopySent] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  useEffect(() => {
    let active = true;
    fetch("/api/public/sessions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("sessions");
        const data: unknown = await response.json();
        if (
          typeof data !== "object" ||
          data === null ||
          !("sessions" in data) ||
          !Array.isArray(data.sessions)
        )
          throw new Error("sessions");
        const values = data.sessions.filter(
          (value): value is string => typeof value === "string" && /^\d{4}-\d{2}$/.test(value),
        );
        if (active) {
          setSessions(values);
          setSession(values[0] ?? "");
        }
      })
      .catch(() => {
        if (active) setSessionsError(true);
      })
      .finally(() => {
        if (active) setSessionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
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
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!sessions.includes(session)) {
      setError("Select a valid passing session.");
      return;
    }
    if (contactMethod === "phone" && !validPhone(contact)) {
      setError("Enter a valid phone number with 8 to 15 digits.");
      return;
    }
    if (phoneOptIn && !validPhone(phoneNumber)) {
      setError("Enter a valid phone number or turn off phone follow-up.");
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
          name,
          session,
          issue,
          email,
          contact,
          contactMethod,
          phoneOptIn,
          ...(phoneOptIn ? { phoneNumber } : {}),
          consent,
          turnstileToken: token,
        }),
        cache: "no-store",
      });
      const data = (await response.json()) as {
        referenceId?: string;
        emailCopySent?: boolean;
        error?: string;
      };
      if (!response.ok || !data.referenceId)
        throw new Error(data.error ?? "Unable to submit your report.");
      setReference(data.referenceId);
      setEmailCopySent(data.emailCopySent === true);
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
            <p className="mt-1 text-xl font-bold tracking-wide text-[var(--text)]">{reference}</p>
            <p className="mt-2 text-xs text-[var(--text)]">
              {"Keep this ID for future communication with the school."}
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {emailCopySent
                ? "A copy of your report was emailed to the address you provided."
                : "Your report is saved, but the email copy could not be sent. Keep your reference ID for follow-up."}
            </p>
            <Link
              href={`/report-status?reference=${encodeURIComponent(reference)}`}
              className="mt-3 inline-block text-sm font-semibold"
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
                className="font-semibold"
              >
                "See our Privacy Policy"
              </Link>
            </p>
            <label className="block text-sm font-semibold">
              {"Student name *"}
              <input
                aria-label="Student name"
                translate="no"
                required aria-required="true"
                minLength={2}
                maxLength={80}
                pattern="[\\p{L}\\p{M} .'-]+"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder={"Name as in school records"}
              />
            </label>
            <label className="block text-sm font-semibold">
              {"Passing session *"}
              <select
                translate="no"
                required aria-required="true"
                value={session}
                disabled={sessionsLoading || sessionsError || sessions.length === 0}
                onChange={(e) => {
                  setSession(e.target.value);
                }}
                className="mt-1 w-full rounded-lg border p-3"
              >
                <option value="" disabled>
                  {sessionsLoading ? "Loading sessions…" : "Select a passing session"}
                </option>
                {sessions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              {sessionsError && (
                <span role="alert" className="mt-1 block text-xs font-normal text-[var(--danger)]">
                  Sessions could not be loaded. Close and reopen the report form to retry.
                </span>
              )}
              {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                <span role="alert" className="mt-1 block text-xs font-normal text-[var(--danger)]">
                  No passing sessions are currently available.
                </span>
              )}
            </label>
            <label className="block text-sm font-semibold">
              {"What is wrong? *"}
              <textarea
                aria-label="What is wrong with the record?"
                translate="no"
                required aria-required="true"
                minLength={10}
                maxLength={2000}
                rows={4}
                value={issue}
                onChange={(e) => {
                  setIssue(e.target.value);
                }}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder={"Describe the incorrect detail or certificate issue"}
              />
            </label>
            <fieldset className="space-y-3 rounded-xl border border-[var(--border)] p-3">
              <legend className="px-1 text-sm font-semibold">Preferred contact method</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-sm">
                  <input
                    aria-label="Contact by email"
                    type="radio"
                    name="contact-method"
                    required
                    checked={contactMethod === "email"}
                    onChange={() => {
                      setContactMethod("email");
                      setContact("");
                      setPhoneOptIn(false);
                      setPhoneNumber("");
                    }}
                  />
                  Email required
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-sm">
                  <input
                    aria-label="Contact by phone"
                    type="radio"
                    name="contact-method"
                    required
                    checked={contactMethod === "phone"}
                    onChange={() => {
                      setContactMethod("phone");
                      setContact("");
                      setPhoneOptIn(false);
                      setPhoneNumber("");
                    }}
                  />
                  Phone required
                </label>
              </div>
              <label className="block text-sm font-semibold">
                {contactMethod === "email"
                  ? "Contact email (required)"
                  : "Contact phone (required)"}
                <input
                  aria-label={contactMethod === "email" ? "Contact email" : "Contact phone"}
                  translate="no"
                  required aria-required="true"
                  type={contactMethod === "email" ? "email" : "tel"}
                  inputMode={contactMethod === "email" ? "email" : "tel"}
                  minLength={contactMethod === "email" ? undefined : 10}
                  maxLength={contactMethod === "email" ? 254 : 16}
                  pattern={contactMethod === "email" ? undefined : "(?:[6-9][0-9]{9}|\\+91[ -]?[6-9][0-9]{5}[ -]?[0-9]{5}|\\+[1-9][0-9]{7,14})"}
                  autoComplete={contactMethod === "email" ? "email" : "tel"}
                  value={contact}
                  onChange={(e) => {
                    setContact(e.target.value);
                  }}
                  className="mt-1 w-full rounded-lg border p-3"
                  placeholder={contactMethod === "email" ? "name@example.com" : "+91 98765 43210"}
                />
              </label>
            <label className="block text-sm font-semibold">
              Email address for your report copy (required)
              <input
                aria-label="Email address for report copy"
                translate="no"
                required aria-required="true"
                type="email"
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); }}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder="name@example.com"
              />
            </label>
              {contactMethod === "email" && (
                <div>
                  <label className="flex items-start gap-2 text-sm leading-5">
                    <input
                      aria-label="I agree to provide a phone number for follow-up"
                      type="checkbox"
                      checked={phoneOptIn}
                      onChange={(e) => {
                        setPhoneOptIn(e.target.checked);
                        if (!e.target.checked) setPhoneNumber("");
                      }}
                      className="mt-1"
                    />
                    <span>Opt in to optional phone follow-up</span>
                  </label>
                  {phoneOptIn && (
                    <label className="mt-2 block text-sm font-semibold">
                      Phone number{" "}
                      <span className="font-normal text-[var(--text-muted)]">
                        (optional follow-up, required when opted in)
                      </span>
                      <input
                        aria-label="Phone number for optional follow-up"
                        type="tel"
                        inputMode="tel"
                        maxLength={24}
                        pattern="(?:[6-9][0-9]{9}|\\+91[ -]?[6-9][0-9]{5}[ -]?[0-9]{5}|\\+[1-9][0-9]{7,14})"
                        autoComplete="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          setPhoneNumber(e.target.value);
                        }}
                        className="mt-1 w-full rounded-lg border p-3"
                        placeholder="+91 98765 43210"
                        required={phoneOptIn}
                      />
                    </label>
                  )}
                </div>
              )}
              <p className="text-xs font-normal text-[var(--text-muted)]">
                Phone numbers must contain 8 to 15 digits. Choose phone contact to make the phone
                number mandatory.
              </p>
            </fieldset>
            <label className="flex items-start gap-2 text-sm leading-5">
              <input
                aria-label="I confirm that I am the student or authorized representative"
                translate="no"
                type="checkbox"
                required aria-required="true"
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
                "I consent to the school using these details to investigate and respond to this report, and emailing a copy to the address provided. I confirm the information is accurate to the best of my knowledge."
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
              disabled={busy || !token || !consent}
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
