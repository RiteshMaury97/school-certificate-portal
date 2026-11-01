"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type SubmitEvent } from "react";

import SiteShell from "@/components/layout/SiteShell";
import { appCheckHeaders } from "@/lib/firebase-client";

type PublicStatus = "received" | "in_review" | "resolved";

export default function ReportStatusView() {
  const [referenceId, setReferenceId] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const captcha = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    if (!siteKey || !captcha.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !captcha.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(captcha.current, {
        sitekey: siteKey,
        callback: (value) => {
          setToken(value);
          setError("");
        },
        "expired-callback": () => {
          setToken("");
        },
        "error-callback": () => {
          setToken("");
          setError("Security check failed to load.");
        },
      });
    };
    const id = "cloudflare-turnstile-script";
    const existing = document.getElementById(id);
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
        setError("Security check failed to load.");
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
    setBusy(true);
    setError("");
    setStatus(null);
    try {
      const response = await fetch("/api/public/report-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
        body: JSON.stringify({ referenceId, turnstileToken: token }),
        cache: "no-store",
      });
      const data: { status?: PublicStatus; error?: string } = await response.json();
      if (!response.ok || !data.status)
        throw new Error(data.error ?? "Unable to check report status.");
      setStatus(data.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to check report status.");
    } finally {
      setBusy(false);
      setToken("");
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    }
  }

  const labels: Record<PublicStatus, string> = {
    received: "Received",
    in_review: "In review",
    resolved: "Resolved",
  };
  return (
    <SiteShell>
      <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-6 shadow-sm sm:p-9">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--primary)]">
          Wrong-record report
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--text)]">Check report status</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          Enter the reference ID you received after submitting your report. This page shows status
          only and does not display personal details.
        </p>
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-[var(--text)]">
            Reference ID
            <input
              required
              maxLength={45}
              autoComplete="off"
              value={referenceId}
              onChange={(event) => {
                setReferenceId(event.target.value.toUpperCase());
              }}
              placeholder="SIS-2026-…"
              className="mt-1.5 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 font-mono"
            />
          </label>
          <div ref={captcha} aria-label="Cloudflare Turnstile security check" />
          {error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          {status && (
            <p role="status" className="rounded-lg bg-[var(--surface-2)] p-4 text-sm">
              <span className="font-semibold">Status: {labels[status]}</span>
              <span className="mt-1 block text-[var(--text-muted)]">
                No personal or case details are shown on this page.
              </span>
            </p>
          )}
          <button
            disabled={busy || !token}
            className="min-h-11 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
          >
            {busy ? "Checking…" : "Check status"}
          </button>
        </form>
        <Link
          href="/report-wrong-record"
          className="mt-5 inline-block text-sm font-semibold text-[var(--primary)] underline"
        >
          Submit a wrong-record report
        </Link>
      </section>
    </SiteShell>
  );
}
