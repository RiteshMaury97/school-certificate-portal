"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Languages } from "lucide-react";
import IconButton from "@/src/components/ui/IconButton";

type Language = { code: string; name: string };
type GoogleTranslateApi = {
  TranslateElement: {
    new (
      options: { pageLanguage: string; includedLanguages: string; layout: number },
      elementId: string,
    ): unknown;
    InlineLayout: { SIMPLE: number };
  };
};
declare global {
  interface Window {
    google?: { translate?: GoogleTranslateApi };
    googleTranslateElementInit?: () => void;
  }
}
const DEFAULT_LANGUAGES: Language[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "bn", name: "বাংলা" },
  { code: "mr", name: "मराठी" },
  { code: "gu", name: "ગુજરાતી" },
  { code: "pa", name: "ਪੰਜਾਬੀ" },
  { code: "ta", name: "தமிழ்" },
  { code: "te", name: "తెలుగు" },
  { code: "ur", name: "اردو" },
];
const DEFAULT_CODES = "en,hi,bn,mr,gu,pa,ta,te,ur";
const SCRIPT_ID = "sis-google-translate-script";
function readSavedLanguage(): string {
  try {
    return localStorage.getItem("sis-google-translate-language") || "en";
  } catch {
    return "en";
  }
}
function setGoogleCookie(language: string) {
  const expiry = "Thu, 01 Jan 1970 00:00:00 GMT";
  const secure = location.protocol === "https:" ? "; Secure" : "";
  if (language === "en") {
    document.cookie = `googtrans=; expires=${expiry}; path=/; SameSite=Lax${secure}`;
    const host = location.hostname;
    if (host.includes("."))
      document.cookie = `googtrans=; expires=${expiry}; path=/; domain=.${host}; SameSite=Lax${secure}`;
  } else {
    document.cookie = `googtrans=/en/${language}; path=/; SameSite=Lax${secure}`;
  }
}
export default function LanguageButton({ includedLanguages }: { includedLanguages?: string }) {
  const location = useLocation();
  const widgetId = `google-translate-${useId().replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("en");
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [languageCodes, setLanguageCodes] = useState(includedLanguages || DEFAULT_CODES);
  const [error, setError] = useState(false);
  const [firstNotice, setFirstNotice] = useState(false);
  const [toast, setToast] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const scriptLoading = useRef(false);
  const failed = useRef(false);
  const configPromise = useRef<Promise<string> | null>(null);
  const configuredCodes = languageCodes
    .split(",")
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
  const languages = ["en", ...configuredCodes.filter((code) => code !== "en")]
    .filter((code, index, array) => array.indexOf(code) === index)
    .map(
      (code) =>
        DEFAULT_LANGUAGES.find((item) => item.code === code) || {
          code,
          name: (() => {
            try {
              return new Intl.DisplayNames([code], { type: "language" }).of(code) || code;
            } catch {
              return code;
            }
          })(),
        },
    );
  function notifyUnavailable() {
    failed.current = true;
    setError(true);
    setToast(true);
    setLoading(false);
    scriptLoading.current = false;
    document.getElementById(SCRIPT_ID)?.remove();
    document.getElementById(widgetId)?.replaceChildren();
    initialized.current = false;
    setSelected("en");
    document.documentElement.lang = "en";
    setGoogleCookie("en");
    try {
      localStorage.setItem("sis-google-translate-language", "en");
    } catch {
      /* Storage may be unavailable. */
    }
    window.dispatchEvent(
      new CustomEvent("sis-google-translate-choice", {
        detail: { language: "en", cookieUsed: false },
      }),
    );
    window.setTimeout(() => setToast(false), 5000);
  }
  function showFirstTranslationNotice() {
    try {
      if (!localStorage.getItem("sis-google-translate-notice")) {
        setFirstNotice(true);
        localStorage.setItem("sis-google-translate-notice", "true");
      }
    } catch {
      setFirstNotice(true);
    }
  }
  function applyToWidget(language: string, attempt = 0) {
    const combo = document
      .getElementById(widgetId)
      ?.querySelector<HTMLSelectElement>(".goog-te-combo");
    if (!combo) {
      if (attempt < 12) window.setTimeout(() => applyToWidget(language, attempt + 1), 250);
      else if (language !== "en") notifyUnavailable();
      return;
    }
    combo.value = language === "en" ? "" : language;
    combo.dispatchEvent(new Event("change", { bubbles: true }));
    if (language !== "en") showFirstTranslationNotice();
  }
  async function resolveLanguageCodes(): Promise<string> {
    if (includedLanguages) {
      setLanguageCodes(includedLanguages);
      return includedLanguages;
    }
    if (!configPromise.current) {
      setConfigLoading(true);
      configPromise.current = fetch("/api/public/site-settings", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) =>
          typeof data?.settings?.includedLanguages === "string" &&
          data.settings.includedLanguages.trim()
            ? data.settings.includedLanguages
            : DEFAULT_CODES,
        )
        .catch(() => DEFAULT_CODES)
        .finally(() => setConfigLoading(false));
    }
    const codes = await configPromise.current!;
    setLanguageCodes(codes);
    return codes;
  }
  function initializeWidget(codes = languageCodes) {
    if (initialized.current || !window.google?.translate) return;
    if (
      !document.getElementById(widgetId) ||
      window.location.pathname === "/admin" ||
      window.location.pathname.startsWith("/admin/")
    )
      return;
    const api = window.google.translate;
    try {
      new api.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: codes.replace(/\s/g, ""),
          layout: api.TranslateElement.InlineLayout.SIMPLE,
        },
        widgetId,
      );
      initialized.current = true;
      setLoading(false);
      window.setTimeout(() => applyToWidget(readSavedLanguage()), 500);
    } catch {
      notifyUnavailable();
    }
  }
  async function loadWidget() {
    if (
      location.pathname === "/admin" ||
      location.pathname.startsWith("/admin/") ||
      window.location.pathname === "/admin" ||
      window.location.pathname.startsWith("/admin/")
    )
      return;
    if (scriptLoading.current) return;
    scriptLoading.current = true;
    failed.current = false;
    setLoading(true);
    setError(false);
    try {
      const codes = await resolveLanguageCodes();
      if (window.google?.translate) {
        initializeWidget(codes);
        return;
      }
      window.googleTranslateElementInit = () => {
        if (!failed.current) initializeWidget(codes);
      };
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      const script = existing ?? document.createElement("script");
      if (!existing) {
        script.id = SCRIPT_ID;
        script.src =
          "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        script.async = true;
        script.defer = true;
        script.nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce || "";
        script.onerror = notifyUnavailable;
        document.head.appendChild(script);
      }
      window.setTimeout(() => {
        if (!failed.current && !initialized.current && !window.google?.translate)
          notifyUnavailable();
      }, 12000);
    } catch {
      notifyUnavailable();
    }
  }
  useEffect(() => {
    if (includedLanguages) setLanguageCodes(includedLanguages);
  }, [includedLanguages]);
  useEffect(() => {
    const saved = readSavedLanguage();
    setSelected(saved);
    document.documentElement.lang = saved;
    const onChoice = (event: Event) => {
      const detail = (event as CustomEvent<{ language?: string }>).detail;
      if (detail?.language) setSelected(detail.language);
    };
    window.addEventListener("sis-google-translate-choice", onChoice);
    return () => window.removeEventListener("sis-google-translate-choice", onChoice);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", keydown);
    };
  }, [open]);
  function chooseLanguage(code: string) {
    setSelected(code);
    setOpen(false);
    setError(false);
    document.documentElement.lang = code;
    setGoogleCookie(code);
    try {
      localStorage.setItem("sis-google-translate-language", code);
    } catch {
      /* Storage may be unavailable. */
    }
    window.dispatchEvent(
      new CustomEvent("sis-google-translate-choice", {
        detail: { language: code, cookieUsed: code !== "en" },
      }),
    );
    if (code === "en") setFirstNotice(false);
    if (!initialized.current) {
      loadWidget();
      return;
    }
    applyToWidget(code);
  }
  function toggleMenu() {
    const next = !open;
    setOpen(next);
    if (next) loadWidget();
  }
  const current = languages.find((item) => item.code === selected)?.name || "English";
  return (
    <div className="relative" ref={menuRef}>
      <IconButton
        label={`Choose page language. Current language: ${current}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
      >
        <Languages size={19} aria-hidden="true" />
      </IconButton>
      {open && (
        <div
          role="menu"
          aria-label="Choose page language"
          className="absolute right-0 top-[calc(100%+8px)] z-[80] max-h-[min(70vh,24rem)] w-52 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] shadow-xl"
        >
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {configLoading
              ? "Loading language options…"
              : loading
                ? "Loading translation…"
                : "Translate page"}
          </p>
          {languages.map((language) => (
            <button
              key={language.code}
              type="button"
              role="menuitemradio"
              aria-checked={selected === language.code}
              disabled={loading || configLoading}
              onClick={() => chooseLanguage(language.code)}
              className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${selected === language.code ? "font-bold text-[var(--primary)]" : "text-[var(--text)]"}`}
            >
              {language.name}
              {selected === language.code ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
          {error && (
            <p role="status" className="px-3 py-2 text-xs text-[var(--danger)]">
              Translation is unavailable right now
            </p>
          )}
        </div>
      )}
      {firstNotice && (
        <p
          role="status"
          className="absolute right-0 top-[calc(100%+8px)] z-[79] mt-1 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text)] shadow-lg"
        >
          Page text is translated by Google Translate{" "}
          <button type="button" onClick={() => setFirstNotice(false)} className="ml-1 underline">
            Dismiss
          </button>
        </p>
      )}
      <div id={widgetId} aria-hidden="true" className="google-translate-hidden" />
      {toast && (
        <p
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[100] max-w-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] shadow-xl"
        >
          Translation is unavailable right now
        </p>
      )}
    </div>
  );
}
