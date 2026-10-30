"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { appCheckHeaders } from "@/src/lib/firebase-client";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function ReportWrongRecordModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState("");
  const [session, setSession] = useState("");
  const [issue, setIssue] = useState("");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
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
            "button,input,textarea,[href],[tabindex]:not([tabindex='-1'])",
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
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (!siteKey || !captcha.current) {
      setCaptchaError(true);
      return;
    }
    let cancelled = false;
    const render = () => {
      if (cancelled || !captcha.current || !window.turnstile || widget.current)
        return;
      try {
        widget.current = window.turnstile.render(captcha.current, {
          sitekey: siteKey,
          callback: (value) => {
            setToken(value);
            setCaptchaError(false);
          },
          "expired-callback": () => setToken(""),
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
    else if (existing)
      existing.addEventListener("load", render, { once: true });
    else {
      const script = document.createElement("script");
      script.id = id;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => setCaptchaError(true);
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile)
        window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!consent || !token) {
      setError(t("consentError"));
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
          contact,
          consent,
          turnstileToken: token,
        }),
        cache: "no-store",
      });
      const data = (await response.json()) as {
        referenceId?: string;
        error?: string;
      };
      if (!response.ok || !data.referenceId)
        throw new Error(data.error ?? "Unable to submit your report.");
      setReference(data.referenceId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to submit your report.",
      );
    } finally {
      setBusy(false);
    }
  }
  const isHindi = i18n.language.startsWith("hi");
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 text-[#20252b] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="report-title" className="text-xl font-bold">
              {t("reportTitle")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t("reportDesc")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="rounded p-2 text-xl"
          >
            ×
          </button>
        </div>
        {reference ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="font-bold text-emerald-900">
              {t("reportSubmitted")}
            </h3>
            <p className="mt-2 text-sm text-emerald-800">{t("referenceId")}</p>
            <p className="mt-1 text-xl font-bold tracking-wide text-emerald-950">
              {reference}
            </p>
            <p className="mt-2 text-xs text-emerald-800">
              {t("keepReference")}
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white"
            >
              {t("close")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              {isHindi
                ? "कई रिकॉर्ड 18 वर्ष से कम आयु के विद्यार्थियों के हैं। यदि विद्यार्थी नाबालिग है, तो माता-पिता या अभिभावक को इस पोर्टल का उपयोग करना चाहिए या उपस्थित रहना चाहिए। विद्यालय इस डेटा का उपयोग केवल प्रमाणपत्र उपलब्ध कराने के लिए करता है। "
                : "Many records belong to students under 18. If the student is a minor, a parent or guardian should use this portal or be present. The school processes this data only to provide certificates. "}
              <Link
                to="/privacy"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                {isHindi ? "गोपनीयता नीति देखें" : "See our Privacy Policy"}
              </Link>
            </p>
            <label className="block text-sm font-semibold">
              {t("studentNameLabel")}
              <input
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder={t("namePlaceholder")}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("passingSession")}
              <input
                required
                pattern="\d{4}-\d{2}"
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder={t("sessionPlaceholder")}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("whatWrong")}
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder={t("issuePlaceholder")}
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("contactLabel")}
              <input
                required
                maxLength={254}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="mt-1 w-full rounded-lg border p-3"
                placeholder={t("contactPlaceholder")}
              />
            </label>
            <label className="flex items-start gap-2 text-sm leading-5">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                {isHindi
                  ? "मैं विद्यार्थी हूँ, या विद्यार्थी का माता-पिता/अभिभावक हूँ। मैं इस रिपोर्ट को भेजने और विद्यालय द्वारा इस उद्देश्य के लिए विवरण उपयोग करने की पुष्टि करता/करती हूँ।"
                  : "I am the student, or the parent/guardian of the student. I confirm that the School may use these details to review this report."}{" "}
                ({t("reportConsent")})
              </span>
            </label>
            <div
              ref={captcha}
              className="min-h-16"
              aria-label="Cloudflare Turnstile security check"
            />
            {captchaError ? (
              <p role="alert" className="text-xs text-red-700">
                {t("captchaUnavailable")}
              </p>
            ) : (
              <p className="text-xs text-slate-500">{t("securityRequired")}</p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              disabled={busy || !token || !consent}
              className="w-full rounded-lg bg-[#263746] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? t("submittingReport") : t("submitReport")}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
