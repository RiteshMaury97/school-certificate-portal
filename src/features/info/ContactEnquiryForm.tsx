"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

const enquiryTypes = [
  ["certificate", "Certificate access"],
  ["student-record", "Student record"],
  ["admission", "Admission"],
  ["general", "General enquiry"],
  ["other", "Other"],
] as const;

// eslint-disable-next-line max-lines-per-function -- Form state, Turnstile and submit confirmation stay together for this focused form.
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
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    if (!siteKey || !captcha.current) {
      setCaptchaError("Security verification is not configured. The enquiry form is unavailable.");
      return;
    }
    let cancelled = false;
    const render = () => {
      if (cancelled || !captcha.current || !window.turnstile || widget.current) return;
      try {
        widget.current = window.turnstile.render(captcha.current, {
          sitekey: siteKey,
          callback: (value) => { setToken(value); setCaptchaError(""); },
          "expired-callback": () => { setToken(""); },
          "error-callback": () => { setToken(""); setCaptchaError("Security verification failed to load. Please retry."); },
        });
      } catch {
        setCaptchaError("Security verification failed to load. Please retry.");
      }
    };
    const scriptId = "cloudflare-turnstile-script";
    const existing = document.getElementById(scriptId);
    if (window.turnstile) render();
    else if (existing) existing.addEventListener("load", render, { once: true });
    else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => { setCaptchaError("Security verification could not load."); };
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  // eslint-disable-next-line complexity -- Each branch provides a specific safe failure response.
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!consent || !token) {
      setError("Please agree to the contact notice and complete the security check.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
        body: JSON.stringify({ fullName, mobile, email, enquiryType, studentName, classSession, subject, message, consent, turnstileToken: token }),
        cache: "no-store",
      });
      const result: unknown = await response.json().catch(() => ({}));
      const errorText = typeof result === "object" && result !== null && "error" in result ? String(result.error) : "Unable to send your enquiry.";
      if (!response.ok) throw new Error(errorText);
      const referenceId = typeof result === "object" && result !== null && "referenceId" in result ? String(result.referenceId) : "Received";
      setReference(referenceId);
      setToken("");
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send your enquiry.");
      setToken("");
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1.5 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus)]";
  if (reference) {
    return (
      <section role="status" className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-6 shadow-sm sm:p-7">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]"><ShieldCheck size={20} aria-hidden="true" /></span>
        <h2 className="mt-4 text-xl font-semibold text-[var(--text)]">Your enquiry has been sent</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">The school office will review your message. Keep this reference for follow-up: <strong className="text-[var(--text)]">{reference}</strong></p>
        <button type="button" onClick={() => { setReference(""); setFullName(""); setMobile(""); setEmail(""); setEnquiryType(""); setStudentName(""); setClassSession(""); setSubject(""); setMessage(""); setConsent(false); }} className="mt-5 min-h-10 rounded-lg border border-[var(--divider)] px-4 text-xs font-semibold text-[var(--text)]">Send another enquiry</button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-semibold text-[var(--text)]">Send us a message</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">Share a few details and the school office can direct your enquiry to the right team.</p>
      <form onSubmit={(event) => { void submit(event); }} className="mt-5 space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor="contact-name" className="text-xs font-semibold text-[var(--text)]">Full name *<input aria-label="Full name" id="contact-name" required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); }} className={inputClass} placeholder="Enter your full name" /></label>
          <label htmlFor="contact-mobile" className="text-xs font-semibold text-[var(--text)]">Mobile number *<input aria-label="Mobile number" id="contact-mobile" required minLength={7} maxLength={30} autoComplete="tel" value={mobile} onChange={(event) => { setMobile(event.target.value); }} className={inputClass} placeholder="+91 XXXXX XXXXX" /></label>
          <label htmlFor="contact-email" className="text-xs font-semibold text-[var(--text)]">Email address *<input aria-label="Email address" id="contact-email" required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); }} className={inputClass} placeholder="you@example.com" /></label>
          <label htmlFor="contact-type" className="text-xs font-semibold text-[var(--text)]">Enquiry type *<select aria-label="Enquiry type" id="contact-type" required value={enquiryType} onChange={(event) => { setEnquiryType(event.target.value); }} className={inputClass}><option value="">Select a topic</option>{enquiryTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label htmlFor="contact-student" className="text-xs font-semibold text-[var(--text)]">Student name (if applicable)<input aria-label="Student name (if applicable)" id="contact-student" maxLength={100} value={studentName} onChange={(event) => { setStudentName(event.target.value); }} className={inputClass} placeholder="Enter student’s name" /></label>
          <label htmlFor="contact-session" className="text-xs font-semibold text-[var(--text)]">Class / session<input aria-label="Class or session" id="contact-session" maxLength={80} value={classSession} onChange={(event) => { setClassSession(event.target.value); }} className={inputClass} placeholder="e.g. Class 10 · 2025–26" /></label>
        </div>
        <label htmlFor="contact-subject" className="block text-xs font-semibold text-[var(--text)]">Subject *<input aria-label="Subject" id="contact-subject" required minLength={3} maxLength={160} value={subject} onChange={(event) => { setSubject(event.target.value); }} className={inputClass} placeholder="Briefly describe your enquiry" /></label>
        <label htmlFor="contact-message" className="block text-xs font-semibold text-[var(--text)]">Message *<textarea aria-label="Message" id="contact-message" required minLength={10} maxLength={3000} rows={4} value={message} onChange={(event) => { setMessage(event.target.value); }} className={`${inputClass} resize-y`} placeholder="Write your message here. Please do not include passwords or sensitive identity details." /></label>
        <div className="flex items-start gap-2 text-[10px] leading-4 text-[var(--text-muted)]"><label htmlFor="contact-consent" className="flex items-start gap-2"><input aria-label="I agree that the school may contact me about this enquiry" id="contact-consent" type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); }} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" />I agree that the school may contact me about this enquiry.</label><a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-[var(--primary)] underline">Privacy Policy</a></div>
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
