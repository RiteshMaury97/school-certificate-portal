"use client";
import { useEffect, useRef, useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

type Choice = boolean | null;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function FeedbackWidget({ page = "/" }: { page?: string }) {
  const [choice, setChoice] = useState<Choice>(null);
  const [comment, setComment] = useState("");
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const displayedError =
    choice !== null && !siteKey
      ? "Security verification is not configured. Feedback is temporarily unavailable."
      : error;

  useEffect(() => {
    if (choice === null) return;
    if (!siteKey || !captcha.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !captcha.current || !window.turnstile || widget.current) return;
      try {
        widget.current = window.turnstile.render(captcha.current, {
          sitekey: siteKey,
          callback: (value) => {
            setToken(value);
            setReady(true);
            setError("");
          },
          "expired-callback": () => { setToken(""); },
          "error-callback": () => {
            setToken("");
            setError("Security verification is unavailable. Please retry.");
          },
        });
      } catch {
        setError("Security verification is unavailable. Please retry.");
      }
    };
    const id = "cloudflare-turnstile-script";
    const existing = document.querySelector<HTMLScriptElement>(`script#${id}`);
    if (window.turnstile) render();
    else if (existing) existing.addEventListener("load", render, { once: true });
    else {
      const script = document.createElement("script");
      script.id = id;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => { setError("Security verification could not load."); };
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [choice, siteKey]);

  async function submit() {
    if (choice === null || !token || sent) return;
    setError("");
    try {
      const response = await fetch("/api/public/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({
          helpful: choice,
          comment: choice ? "" : comment,
          page,
          turnstileToken: token,
        }),
        cache: "no-store",
      });
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      const message = isRecord(data) && typeof data.error === "string" ? data.error : undefined;
      if (!response.ok) throw new Error(message ?? "Feedback could not be submitted.");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feedback could not be submitted.");
      setToken("");
      setReady(false);
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    }
  }

  return (
    <section
      aria-labelledby="feedback-title"
      className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <h2 id="feedback-title" className="text-base font-bold text-[var(--text)]">
        Was this helpful?
      </h2>
      {sent ? (
        <p role="status" className="mt-2 text-sm text-[var(--text)]">
          Thank you for your feedback.
        </p>
      ) : (
        <>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              aria-pressed={choice === true}
              onClick={() => {
                setChoice(true);
                setToken("");
                setReady(false);
                setError("");
              }}
              className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold ${choice === true ? "border-[var(--primary)] bg-[var(--surface-2)]" : "border-[var(--border)]"}`}
            >
              👍 Yes
            </button>
            <button
              type="button"
              aria-pressed={choice === false}
              onClick={() => {
                setChoice(false);
                setToken("");
                setReady(false);
                setError("");
              }}
              className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold ${choice === false ? "border-[var(--primary)] bg-[var(--surface-2)]" : "border-[var(--border)]"}`}
            >
              👎 No
            </button>
          </div>
          {choice === false && (
            <label className="mt-4 block text-sm font-medium text-[var(--text)]">
              What could be improved? (optional)
              <textarea
                translate="no"
                aria-label="Feedback suggestion"
                value={comment}
                onChange={(e) => { setComment(e.target.value.slice(0, 200)); }}
                maxLength={200}
                rows={3}
                className="mt-1 w-full rounded-lg border border-[var(--border)] p-3"
                placeholder="Your suggestion (max 200 characters)"
              />
              <span className="mt-1 block text-xs text-[var(--text)]">
                Do not enter personal details. {comment.length}/200
              </span>
            </label>
          )}
          {choice !== null && (
            <>
              <div
                ref={captcha}
                className="mt-4 min-h-[66px]"
                aria-label="Cloudflare security verification"
              />
              <button
                type="button"
                disabled={!token || !ready}
                onClick={() => void submit()}
                className="mt-3 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
              >
                Submit feedback
              </button>
            </>
          )}
          {displayedError && (
            <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
              {displayedError}
            </p>
          )}
        </>
      )}
    </section>
  );
}
