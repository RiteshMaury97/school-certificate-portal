"use client";

import { useEffect, useRef, useState } from "react";

import { applyCspNonce } from "@/lib/csp";

type Props = {
  attempt: number;
  onToken: (token: string) => void;
  onRetry: () => void;
};

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
export const adminCaptchaRequired = process.env.NODE_ENV === "production" || Boolean(siteKey);

export default function AdminTurnstile({ attempt, onToken, onRetry }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!adminCaptchaRequired) return;
    if (!siteKey) return;
    let cancelled = false;
    const scriptId = "cloudflare-turnstile-script";
    const existing = document.querySelector<HTMLScriptElement>(`script#${scriptId}`);
    const render = () => {
      if (cancelled || !container.current || !window.turnstile || widgetId.current) return;
      try {
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          appearance: "always",
          callback: (token) => {
            onToken(token);
            setError("");
          },
          "expired-callback": () => {
            onToken("");
          },
          "error-callback": () => {
            onToken("");
            setError("The security check could not load. Retry or contact the site owner.");
          },
        });
      } catch {
        setError("The security check could not load. Retry or contact the site owner.");
      }
    };
    const handleError = () => {
      if (!cancelled)
        setError("The security check could not load. Retry or contact the site owner.");
    };

    if (window.turnstile) render();
    else if (existing) {
      existing.addEventListener("load", render, { once: true });
      existing.addEventListener("error", handleError, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      applyCspNonce(script);
      script.addEventListener("load", render, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      existing?.removeEventListener("load", render);
      existing?.removeEventListener("error", handleError);
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [attempt, onToken]);

  if (!adminCaptchaRequired) return null;
  const displayedError = siteKey
    ? error
    : "The security check is not configured. Contact the site owner.";
  return (
    <div className="space-y-2" aria-label="Security verification">
      <div ref={container} className="min-h-[65px]" />
      {displayedError && (
        <div
          className="flex items-center justify-between gap-3 text-sm text-[var(--danger)]"
          role="alert"
        >
          <span>{displayedError}</span>
          <button
            type="button"
            onClick={() => {
              if (!window.turnstile)
                document.getElementById("cloudflare-turnstile-script")?.remove();
              onRetry();
            }}
            className="shrink-0 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
