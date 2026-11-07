"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import { FormErrorSummary } from "@/components/forms/FormErrorSummary";
import { FormField } from "@/components/forms/FormField";
import { useFormValidation } from "@/components/forms/useFormValidation";
import { applyCspNonce } from "@/lib/csp";
import { appCheckHeaders } from "@/lib/firebase-client";
import { contactEnquirySchema } from "@/shared/validation";

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
      applyCspNonce(script);
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
  const validation = useFormValidation(contactEnquirySchema, {
    fullName, mobile, email, enquiryType, studentName, classSession, subject, message, consent, turnstileToken: token,
  });

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!validation.validate(true)) return;
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
      inputClass={inputClass}
      fieldErrors={validation.errors}
      onFieldBlur={validation.onBlur}
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
  inputClass: string;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  fieldErrors: Record<string, string>;
  onFieldBlur: (name: string) => (event: React.FocusEvent<HTMLElement>) => void;
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
  inputClass,
  fieldErrors,
  onFieldBlur,
  onSubmit,
}: ContactFormViewProps) {
  return (
    <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-[var(--text)]">Send us a message</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Share a few details and the school office can direct your enquiry to the right team.</p>
      <form noValidate onSubmit={onSubmit} className="mt-5 space-y-3.5">
        <FormErrorSummary errors={fieldErrors} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="contact-name" label="Full name" required helperText="Use the name shown in school records." error={fieldErrors.fullName}>
            <input name="fullName" aria-label="Full name" translate="no" type="text" minLength={2} maxLength={80} pattern="[\\p{L}\\p{M} .'-]+" autoComplete="name" value={fullName} onBlur={onFieldBlur("fullName")} onChange={(event) => { setFullName(event.target.value); }} className={inputClass} placeholder="Enter your full name" required aria-required="true" />
          </FormField>
          <FormField id="contact-mobile" label="Mobile number" required helperText="Enter a 10-digit Indian mobile or international number in E.164 format." error={fieldErrors.mobile}>
            <input name="mobile" aria-label="Mobile number" translate="no" type="tel" minLength={10} maxLength={16} pattern="(?:[6-9][0-9]{9}|\\+91[ -]?[6-9][0-9]{5}[ -]?[0-9]{5}|\\+[1-9][0-9]{7,14})" autoComplete="tel" inputMode="tel" value={mobile} onBlur={onFieldBlur("mobile")} onChange={(event) => { setMobile(event.target.value); }} className={inputClass} placeholder="98765 43210 or +14155552671" required aria-required="true" />
          </FormField>
          <FormField id="contact-email" label="Email address" required error={fieldErrors.email}>
            <input name="email" aria-label="Email address" translate="no" type="email" maxLength={254} autoComplete="email" inputMode="email" value={email} onBlur={onFieldBlur("email")} onChange={(event) => { setEmail(event.target.value); }} className={inputClass} placeholder="you@example.com" required aria-required="true" />
          </FormField>
          <FormField id="contact-type" label="Enquiry type" required error={fieldErrors.enquiryType}>
            <select name="enquiryType" aria-label="Enquiry type" value={enquiryType} onBlur={onFieldBlur("enquiryType")} onChange={(event) => { setEnquiryType(event.target.value); }} className={inputClass} required aria-required="true"><option value="">Select a topic</option>{enquiryTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </FormField>
          <FormField id="contact-student" label="Student name" required error={fieldErrors.studentName}>
            <input name="studentName" aria-label="Student name" translate="no" type="text" minLength={2} maxLength={80} pattern="[\\p{L}\\p{M} .'-]+" autoComplete="off" value={studentName} onBlur={onFieldBlur("studentName")} onChange={(event) => { setStudentName(event.target.value); }} className={inputClass} placeholder="Enter student’s name" required aria-required="true" />
          </FormField>
          <FormField id="contact-session" label="Class / session" required error={fieldErrors.classSession}>
            <input name="classSession" aria-label="Class or session" minLength={2} maxLength={80} value={classSession} onBlur={onFieldBlur("classSession")} onChange={(event) => { setClassSession(event.target.value); }} className={inputClass} placeholder="e.g. Class 10 · 2025–26" required aria-required="true" />
          </FormField>
        </div>
        <FormField id="contact-subject" label="Subject" required error={fieldErrors.subject}>
          <input name="subject" aria-label="Subject" minLength={3} maxLength={160} value={subject} onBlur={onFieldBlur("subject")} onChange={(event) => { setSubject(event.target.value); }} className={inputClass} placeholder="Briefly describe your enquiry" required aria-required="true" />
        </FormField>
        <FormField id="contact-message" label="Message" required helperText="Please do not include passwords or sensitive identity details." error={fieldErrors.message}>
          <textarea name="message" aria-label="Message" minLength={10} maxLength={3000} rows={4} value={message} onBlur={onFieldBlur("message")} onChange={(event) => { setMessage(event.target.value); }} className={`${inputClass} resize-y`} placeholder="Write your message here." required aria-required="true" />
        </FormField>
        <div className="flex items-start gap-2 text-[10px] leading-4 text-[var(--text-muted)]"><label htmlFor="contact-consent" className="flex items-start gap-2"><input aria-label="I agree that the school may contact me and email me a copy of this enquiry" id="contact-consent" type="checkbox" required aria-required="true" aria-invalid={Boolean(fieldErrors.consent)} aria-describedby="contact-consent-error" checked={consent} onBlur={onFieldBlur("consent")} onChange={(event) => { setConsent(event.target.checked); }} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" />I agree that the school may contact me about this enquiry and email me a copy. *</label><a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-[var(--primary)]">Privacy Policy</a></div>
        {fieldErrors.consent && <p id="contact-consent-error" className="flex items-center gap-1.5 text-sm font-medium text-[var(--danger)]" role="alert"><ShieldCheck size={15} aria-hidden="true" />{fieldErrors.consent}</p>}
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--text)]">Security check *</p>
          <div ref={captcha} aria-label="Cloudflare security verification" className="min-h-[66px]" />
          {fieldErrors.turnstileToken && <p role="alert" className="mt-1 text-sm font-medium text-[var(--danger)]">{fieldErrors.turnstileToken}</p>}
          {captchaError && <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{captchaError}</p>}
        </div>
        {error && <p role="alert" className="rounded-lg bg-[var(--surface-2)] p-3 text-xs text-[var(--danger)]">{error}</p>}
        <button type="submit" aria-busy={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)]">{busy ? "Sending enquiry…" : "Send enquiry"} <ArrowRight size={14} aria-hidden="true" /></button>
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
