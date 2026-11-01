"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

import type { SubmitEvent } from "react";


type Status = "received" | "in_review" | "resolved";

function isStatus(value: unknown): value is Status {
  return value === "received" || value === "in_review" || value === "resolved";
}

function useTurnstileToken() {
  const captchaRef = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || !captchaRef.current) return;
    let cancelled = false;
    const render = () => {
      const node = captchaRef.current;
      const api = window.turnstile;
      if (cancelled || !node || !api || widget.current) return;
      widget.current = api.render(node, {
        sitekey: siteKey,
        callback: (value: string) => {
          setToken(value);
        },
        "expired-callback": () => {
          setToken("");
        },
        "error-callback": () => {
          setToken("");
        },
      });
    };
    const existing = document.getElementById("cloudflare-turnstile-script");
    if (window.turnstile) render();
    else if (existing instanceof HTMLScriptElement) existing.addEventListener("load", render);
    else {
      const script = document.createElement("script");
      script.id = "cloudflare-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render);
      document.head.append(script);
    }
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  return { captchaRef, token, setToken, widget };
}

async function requestReportStatus(referenceId: string, token: string): Promise<Status> {
  const response = await fetch("/api/public/report-status", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
    body: JSON.stringify({ referenceId, turnstileToken: token }),
    cache: "no-store",
  });
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) throw new Error("Unable to check report status.");
  if (!response.ok)
    throw new Error(
      "error" in body && typeof body.error === "string"
        ? body.error
        : "Unable to check report status.",
    );
  if ("status" in body && isStatus(body.status)) return body.status;
  throw new Error("Unable to check report status.");
}

export default function ReportStatusView({ initialReference = "" }: { initialReference?: string }) {
  const { captchaRef, token, setToken, widget } = useTurnstileToken();
  const [referenceId, setReferenceId] = useState(initialReference);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus(null);
    setBusy(true);
    try {
      setStatus(await requestReportStatus(referenceId, token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to check report status.");
    } finally {
      setBusy(false);
      setToken("");
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    }
  }

  const labels: Record<Status, string> = {
    received: "Received",
    in_review: "In review",
    resolved: "Resolved",
  };
  return (
    <main className="mx-auto min-h-[70vh] max-w-2xl px-4 py-12">
      <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--primary)]">
          Report follow-up
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text)]">Check report status</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          Enter the reference ID shown after you submitted your report. This page displays status
          only and does not show personal information.
        </p>
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          className="mt-6 space-y-4"
        >
          <label className="block text-sm font-semibold text-[var(--text)]">
            Report reference ID
            <input
              id="report-reference"
              required
              value={referenceId}
              onChange={(event) => {
                setReferenceId(event.target.value.toUpperCase());
              }}
              autoComplete="off"
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 font-mono"
              placeholder="SIS-2026-XXXXXXXX"
            />
          </label>
          <div
            ref={captchaRef}
            aria-label="Cloudflare Turnstile security check"
            className="min-h-[66px]"
          />
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--danger)]"
            >
              {error}
            </p>
          )}
          {status && (
            <p
              role="status"
              className="rounded-lg border border-[var(--divider)] bg-[var(--surface-2)] p-4 text-sm"
            >
              Report status: <strong>{labels[status]}</strong>
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !token}
            className="min-h-11 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
          >
            {busy ? "Checking…" : "Check status"}
          </button>
        </form>
        <Link
          href="/"
          className="mt-5 inline-block text-sm font-semibold text-[var(--primary)] underline"
        >
          Return to the portal
        </Link>
      </section>
    </main>
  );
}
