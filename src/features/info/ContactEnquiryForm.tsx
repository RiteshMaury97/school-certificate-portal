"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

const enquiryTypes = [
  ["certificate", "Certificate access"],
  ["student-record", "Student record"],
  ["admission", "Admission"],
  ["general", "General enquiry"],
  ["other", "Other"],
] as const;

type ContactSubmission = {
  fullName: string;
  mobile: string;
  email: string;
  enquiryType: string;
  studentName: string;
  classSession: string;
  subject: string;
  message: string;
  consent: boolean;
  turnstileToken: string;
};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

function getTurnstile(): TurnstileApi | null {
  const candidate: unknown = Reflect.get(window, "turnstile");
  return isTurnstileApi(candidate) ? candidate : null;
}

function isTurnstileApi(candidate: unknown): candidate is TurnstileApi {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    typeof Reflect.get(candidate, "render") === "function" &&
    typeof Reflect.get(candidate, "remove") === "function" &&
    typeof Reflect.get(candidate, "reset") === "function"
  );
}

function useContactTurnstile(
  siteKey: string,
  setToken: Dispatch<SetStateAction<string>>,
  setCaptchaError: Dispatch<SetStateAction<string>>,
) {
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !captcha.current) {
      setCaptchaError("Security verification is not configured. The enquiry form is unavailable.");
      return;
    }
    let cancelled = false;
    const render = () => {
      const turnstile = getTurnstile();
      if (cancelled || !captcha.current || !turnstile || widget.current) return;
      try {
        widget.current = turnstile.render(captcha.current, {
          sitekey: siteKey,
          callback: (value) => {
            setToken(value);
            setCaptchaError("");
          },
          "expired-callback": () => {
            setToken("");
          },
          "error-callback": () => {
            setToken("");
            setCaptchaError("Security verification failed to load. Please retry.");
          },
        });
      } catch {
        setCaptchaError("Security verification failed to load. Please retry.");
      }
    };
    const scriptId = "cloudflare-turnstile-script";
    const existing = document.getElementById(scriptId);
    if (getTurnstile()) render();
    else if (existing) existing.addEventListener("load", render, { once: true });
    else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => {
        setCaptchaError("Security verification could not load.");
      };
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      const turnstile = getTurnstile();
      if (widget.current && turnstile) turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, setCaptchaError, setToken]);

  return { captcha, widget };
}

export default function ContactEnquiryForm() {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [enquiryType, setEnquiryType] = useState("");
  const [studentName, setStudentName] = useState("");
  const [classSession, setClassSession] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [emailCopySent, setEmailCopySent] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const { captcha, widget } = useContactTurnstile(siteKey, setToken, setCaptchaError);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!consent || !token) {
      setError("Please agree to the contact notice and complete the security check.");
      return;
    }
    setBusy(true);
    try {
      const result = await sendContactEnquiry({
        fullName,
        mobile,
        email,
        enquiryType,
        studentName,
        classSession,
        subject,
        message,
        consent,
        turnstileToken: token,
      });
      setReference(result.referenceId);
      setEmailCopySent(result.emailCopySent);
      setToken("");
      resetTurnstile(widget.current);
    } catch (cause) {
      setError(contactErrorMessage(cause));
      setToken("");
      resetTurnstile(widget.current);
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1.5 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus)]";
  if (reference) {
    return (
      <EnquirySent
        reference={reference}
        emailCopySent={emailCopySent}
        onReset={() => {
          setReference("");
          setEmailCopySent(false);
          setFullName("");
          setMobile("");
          setEmail("");
          setEnquiryType("");
          setStudentName("");
          setClassSession("");
          setSubject("");
          setMessage("");
          setConsent(false);
        }}
      />
    );
  }

  return (
    <ContactFormView
      fullName={fullName}
      setFullName={setFullName}
      mobile={mobile}
      setMobile={setMobile}
      email={email}
      setEmail={setEmail}
      enquiryType={enquiryType}
      setEnquiryType={setEnquiryType}
      studentName={studentName}
      setStudentName={setStudentName}
      classSession={classSession}
      setClassSession={setClassSession}
      subject={subject}
      setSubject={setSubject}
      message={message}
      setMessage={setMessage}
      consent={consent}
      setConsent={setConsent}
      captcha={captcha}
      captchaError={captchaError}
      error={error}
      busy={busy}
      token={token}
      inputClass={inputClass}
      onSubmit={(event) => {
        void submit(event);
      }}
    />
  );
}

type ContactFormViewProps = {
  fullName: string;
  setFullName: Dispatch<SetStateAction<string>>;
  mobile: string;
  setMobile: Dispatch<SetStateAction<string>>;
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  enquiryType: string;
  setEnquiryType: Dispatch<SetStateAction<string>>;
  studentName: string;
  setStudentName: Dispatch<SetStateAction<string>>;
  classSession: string;
  setClassSession: Dispatch<SetStateAction<string>>;
  subject: string;
  setSubject: Dispatch<SetStateAction<string>>;
  message: string;
  setMessage: Dispatch<SetStateAction<string>>;
  consent: boolean;
  setConsent: Dispatch<SetStateAction<boolean>>;
  captcha: RefObject<HTMLDivElement | null>;
  captchaError: string;
  error: string;
  busy: boolean;
  token: string;
  inputClass: string;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
};

function ContactFormView({
  fullName,
  setFullName,
  mobile,
  setMobile,
  email,
  setEmail,
  enquiryType,
  setEnquiryType,
  studentName,
  setStudentName,
  classSession,
  setClassSession,
  subject,
  setSubject,
  message,
  setMessage,
  consent,
  setConsent,
  captcha,
  captchaError,
  error,
  busy,
  token,
  inputClass,
  onSubmit,
}: ContactFormViewProps) {
  return (
    <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-[var(--text)]">Send us a message</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Share a few details and the school office can direct your enquiry to the right team.</p>
      <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor="contact-name" className="text-xs font-semibold text-[var(--text)]">Full name *<input aria-label="Full name" id="contact-name" required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); }} className={inputClass} placeholder="Enter your full name" /></label>
          <label htmlFor="contact-mobile" className="text-xs font-semibold text-[var(--text)]">Mobile number *<input aria-label="Mobile number" id="contact-mobile" required minLength={7} maxLength={30} pattern="[+0-9() .-]+" title="Enter a phone number with 8 to 15 digits." autoComplete="tel" inputMode="tel" value={mobile} onChange={(event) => { setMobile(event.target.value); }} className={inputClass} placeholder="+91 XXXXX XXXXX" /></label>
          <label htmlFor="contact-email" className="text-xs font-semibold text-[var(--text)]">Email address *<input aria-label="Email address" id="contact-email" required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); }} className={inputClass} placeholder="you@example.com" /></label>
          <label htmlFor="contact-type" className="text-xs font-semibold text-[var(--text)]">Enquiry type *<select aria-label="Enquiry type" id="contact-type" required value={enquiryType} onChange={(event) => { setEnquiryType(event.target.value); }} className={inputClass}><option value="">Select a topic</option>{enquiryTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label htmlFor="contact-student" className="text-xs font-semibold text-[var(--text)]">Student name *<input aria-label="Student name" id="contact-student" required minLength={2} maxLength={100} value={studentName} onChange={(event) => { setStudentName(event.target.value); }} className={inputClass} placeholder="Enter student’s name" /></label>
          <label htmlFor="contact-session" className="text-xs font-semibold text-[var(--text)]">Class / session *<input aria-label="Class or session" id="contact-session" required minLength={2} maxLength={80} value={classSession} onChange={(event) => { setClassSession(event.target.value); }} className={inputClass} placeholder="e.g. Class 10 · 2025–26" /></label>
        </div>
        <label htmlFor="contact-subject" className="block text-xs font-semibold text-[var(--text)]">Subject *<input aria-label="Subject" id="contact-subject" required minLength={3} maxLength={160} value={subject} onChange={(event) => { setSubject(event.target.value); }} className={inputClass} placeholder="Briefly describe your enquiry" /></label>
        <label htmlFor="contact-message" className="block text-xs font-semibold text-[var(--text)]">Message *<textarea aria-label="Message" id="contact-message" required minLength={10} maxLength={3000} rows={4} value={message} onChange={(event) => { setMessage(event.target.value); }} className={`${inputClass} resize-y`} placeholder="Write your message here. Please do not include passwords or sensitive identity details." /></label>
        <div className="flex items-start gap-2 text-[10px] leading-4 text-[var(--text-muted)]"><label htmlFor="contact-consent" className="flex items-start gap-2"><input aria-label="I agree that the school may contact me and email me a copy of this enquiry" id="contact-consent" type="checkbox" required checked={consent} onChange={(event) => { setConsent(event.target.checked); }} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" />I agree that the school may contact me about this enquiry and email me a copy.</label><a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-[var(--primary)] underline">Privacy Policy</a></div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--text)]">Security check *</p>
          <div ref={captcha} aria-label="Cloudflare security verification" className="min-h-[66px]" />
          {captchaError && <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{captchaError}</p>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-[var(--surface-2)] p-3 text-xs text-[var(--danger)]">{error}</p>}
        <button type="submit" disabled={busy || !token || !consent} aria-busy={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Sending enquiry…" : "Send enquiry"} <ArrowRight size={14} aria-hidden="true" /></button>
      </form>
    </section>
  );
}

async function sendContactEnquiry(submission: ContactSubmission): Promise<{ referenceId: string; emailCopySent: boolean }> {
  const response = await fetch("/api/public/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
    body: JSON.stringify(submission),
    cache: "no-store",
  });
  const result: unknown = await response.json().catch(() => ({}));
  const errorText =
    typeof result === "object" && result !== null && "error" in result
      ? String(result.error)
      : "Unable to send your enquiry.";
  if (!response.ok) throw new Error(errorText);
  return typeof result === "object" && result !== null && "referenceId" in result
    ? {
        referenceId: String(result.referenceId),
        emailCopySent: "emailCopySent" in result && result.emailCopySent === true,
      }
    : { referenceId: "Received", emailCopySent: false };
}

function resetTurnstile(widgetId: string | null): void {
  const turnstile = getTurnstile();
  if (widgetId && turnstile) turnstile.reset(widgetId);
}

function contactErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Unable to send your enquiry.";
}

function EnquirySent({ reference, emailCopySent, onReset }: { reference: string; emailCopySent: boolean; onReset: () => void }) {
  return (
    <section
      role="status"
      className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-6 shadow-sm sm:p-7"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]">
        <ShieldCheck size={20} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-semibold text-[var(--text)]">Your enquiry has been sent</h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        The school office will review your message. Keep this reference for follow-up:{" "}
        <strong className="text-[var(--text)]">{reference}</strong>
      </p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {emailCopySent
          ? "A copy of your message was emailed to you."
          : "Your enquiry is saved, but the email copy could not be sent. Contact the school if you need the message details."}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 min-h-10 rounded-lg border border-[var(--divider)] px-4 text-xs font-semibold text-[var(--text)]"
      >
        Send another enquiry
      </button>
    </section>
  );
}
