"use client";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "@/src/lib/i18n";
import ReportWrongRecordModal from "@/src/components/ReportWrongRecordModal";
type SiteSettings = {
  schoolName?: string;
  tagline?: string;
  logoUrl?: string;
  statusPageUrl?: string;
  announcement?: {
    type: "info" | "warning";
    textEn: string;
    textHi: string;
    linkUrl: string;
  } | null;
  boardName?: string;
  affiliationNumber?: string;
  schoolCode?: string;
  principalPhotoUrl?: string;
  principalName?: string;
  principalMessage?: string;
  address?: string;
  phone?: string;
  email?: string;
  officeHours?: string;
  mapUrl?: string;
  socialLinks?: { label: string; url: string }[];
  grievanceOfficerName?: string;
  grievanceOfficerEmail?: string;
  grievanceOfficerPhone?: string;
  lastUpdated?: string;
};
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [dismissalLoaded, setDismissalLoaded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [highContrast, setHighContrast] = useState(false);
  const location = useLocation();
  const { t } = useTranslation();
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
  }, []);
  useEffect(() => {
    setAnnouncementDismissed(
      sessionStorage.getItem("sis-announcement-dismissed") === "true",
    );
    setDismissalLoaded(true);
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/public/site-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active && d && typeof d.settings === "object")
          setSettings(d.settings as SiteSettings);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem("sis-theme");
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const initial =
      saved === "dark" || saved === "light"
        ? saved
        : media.matches
          ? "dark"
          : "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    const contrast = localStorage.getItem("sis-high-contrast") === "true";
    setHighContrast(contrast);
    document.documentElement.classList.toggle("high-contrast", contrast);
    const onChange = (event: MediaQueryListEvent) => {
      if (!localStorage.getItem("sis-theme")) {
        setTheme(event.matches ? "dark" : "light");
        document.documentElement.classList.toggle("dark", event.matches);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("sis-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }
  function toggleContrast() {
    const next = !highContrast;
    setHighContrast(next);
    localStorage.setItem("sis-high-contrast", String(next));
    document.documentElement.classList.toggle("high-contrast", next);
  }
  function changeLanguage(value: "en" | "hi") {
    localStorage.setItem("sis-language", value);
    document.documentElement.lang = value;
    void i18n.changeLanguage(value);
  }
  const socialLinks = Array.isArray(settings.socialLinks)
    ? settings.socialLinks
    : [];
  const announcementText = i18n.language.startsWith("hi")
    ? settings.announcement?.textHi
    : settings.announcement?.textEn;
  return (
    <div className="min-h-screen bg-[#f4f5f6] text-[#20252b] transition-colors dark:bg-slate-950 dark:text-slate-100">
      {location.pathname === "/" &&
        dismissalLoaded &&
        settings.announcement &&
        !announcementDismissed &&
        announcementText && (
          <div
            role="status"
            aria-live="polite"
            className={`border-b px-5 py-3 ${settings.announcement.type === "warning" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-blue-200 bg-blue-50 text-blue-950"}`}
          >
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm font-medium">
                {announcementText}
                {settings.announcement.linkUrl && (
                  <a
                    href={settings.announcement.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 font-bold underline"
                  >
                    {i18n.language.startsWith("hi")
                      ? "अधिक जानें"
                      : "Learn more"}
                  </a>
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem("sis-announcement-dismissed", "true");
                  setAnnouncementDismissed(true);
                }}
                aria-label={
                  i18n.language.startsWith("hi")
                    ? "सूचना बंद करें"
                    : "Dismiss announcement"
                }
                className="min-h-9 rounded border border-current/30 px-3 py-1 text-xs font-semibold"
              >
                {i18n.language.startsWith("hi") ? "बंद करें" : "Dismiss"}
              </button>
            </div>
          </div>
        )}
      <header className="border-b border-[#dfe3e7] bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-4 sm:px-8">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={`${settings.schoolName ?? "School"} logo`}
              className="h-14 w-14 shrink-0 rounded-lg object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <Link
              to="/"
              className="block truncate text-base font-bold tracking-tight text-[#20252b] dark:text-white sm:text-lg"
            >
              {settings.schoolName ?? "Certificate Portal"}
            </Link>
            {settings.tagline ? (
              <p className="text-xs text-[#626c76] dark:text-slate-400 sm:text-sm">
                {settings.tagline}
              </p>
            ) : null}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="language-toggle">
              {t("language")}
            </label>
            <select
              id="language-toggle"
              aria-label={t("language")}
              value={i18n.language.startsWith("hi") ? "hi" : "en"}
              onChange={(e) => changeLanguage(e.target.value as "en" | "hi")}
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`${t("theme")}: ${theme}`}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-100"
            >
              {theme === "dark" ? "☀" : "☾"}{" "}
              {theme === "dark" ? t("light") : t("dark")}
            </button>
            <button
              type="button"
              onClick={toggleContrast}
              aria-pressed={highContrast}
              className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700"
            >
              {highContrast ? t("standardContrast") : t("highContrast")}
            </button>
            <Link
              to="/admin/login"
              className="rounded-lg border border-[#cbd2d9] px-3 py-2 text-sm font-semibold text-[#354454] transition hover:bg-[#f3f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#263746] dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {t("admin")}
            </Link>
          </div>
        </div>
      </header>
      {(settings.boardName ||
        settings.affiliationNumber ||
        settings.schoolCode) && (
        <section className="border-b border-[#dfe3e7] bg-[#263746] text-white">
          <div className="mx-auto grid max-w-6xl gap-3 px-5 py-3 text-xs sm:grid-cols-3 sm:px-8">
            <div>
              <span className="block text-white/65">Board / Affiliation</span>
              <strong className="mt-0.5 block text-sm">
                {settings.boardName || "—"}
              </strong>
            </div>
            <div>
              <span className="block text-white/65">Affiliation number</span>
              <strong className="mt-0.5 block text-sm">
                {settings.affiliationNumber || "—"}
              </strong>
            </div>
            <div>
              <span className="block text-white/65">School code</span>
              <strong className="mt-0.5 block text-sm">
                {settings.schoolCode || "—"}
              </strong>
            </div>
          </div>
        </section>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12"
      >
        {children}
      </main>
      {location.pathname === "/" &&
        (settings.principalMessage ||
          settings.principalName ||
          settings.principalPhotoUrl) && (
          <section className="border-t border-[#dfe3e7] bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto grid max-w-6xl gap-6 px-5 py-9 sm:grid-cols-[180px_1fr] sm:items-center sm:px-8">
              <div className="mx-auto h-36 w-36 overflow-hidden rounded-full bg-[#eef1f3] sm:mx-0">
                {settings.principalPhotoUrl ? (
                  <img
                    src={settings.principalPhotoUrl}
                    alt={
                      settings.principalName
                        ? `Photo of ${settings.principalName}`
                        : "Principal"
                    }
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#20252b] dark:text-white">
                  {t("principalMessage")}
                </h2>
                {settings.principalMessage ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#53606c] dark:text-slate-300">
                    {settings.principalMessage}
                  </p>
                ) : null}
                {settings.principalName ? (
                  <p className="mt-3 font-semibold text-[#263746] dark:text-slate-200">
                    {settings.principalName}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        )}
      <footer className="mt-10 border-t border-[#dfe3e7] bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:grid-cols-2 lg:grid-cols-4 sm:px-8">
          <section>
            <h2 className="font-bold text-[#20252b] dark:text-white">
              {settings.schoolName ?? "School"}
            </h2>
            {settings.address ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#626c76] dark:text-slate-300">
                {settings.address}
              </p>
            ) : null}
            {settings.mapUrl ? (
              <a
                href={settings.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm underline"
              >
                View map
              </a>
            ) : null}
            {settings.phone ? (
              <a
                href={`tel:${settings.phone}`}
                className="mt-2 block text-sm text-[#626c76] dark:text-slate-300"
              >
                {settings.phone}
              </a>
            ) : null}
            {settings.email ? (
              <a
                href={`mailto:${settings.email}`}
                className="mt-1 block break-all text-sm text-[#354f68] underline dark:text-sky-300"
              >
                {settings.email}
              </a>
            ) : null}
            {settings.officeHours ? (
              <p className="mt-2 text-xs text-[#697582] dark:text-slate-400">
                {t("officeHours")}: {settings.officeHours}
              </p>
            ) : null}
          </section>
          <nav aria-label={t("quickLinks")}>
            <h2 className="font-bold text-[#20252b] dark:text-white">
              {t("quickLinks")}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#53606c] dark:text-slate-300">
              <li>
                <Link to="/">{t("home")}</Link>
              </li>
              <li>
                <Link to="/verify">{t("verify")}</Link>
              </li>
              <li>
                <Link to="/faq">{t("faq")}</Link>
              </li>
              <li>
                <Link to="/terms">{t("terms")}</Link>
              </li>
              <li>
                <Link to="/privacy">{t("privacy")}</Link>
              </li>
              <li>
                <button
                  onClick={() => setReportOpen(true)}
                  className="text-left underline"
                >
                  {t("report")}
                </button>
              </li>
              {settings.statusPageUrl && (
                <li>
                  <a
                    href={settings.statusPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    System status
                  </a>
                </li>
              )}
            </ul>
          </nav>
          <section>
            <h2 className="font-bold text-[#20252b] dark:text-white">
              {t("connect")}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#53606c] dark:text-slate-300">
              {socialLinks.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[#697582] dark:text-slate-400">
              {t("lastUpdated")}: {settings.lastUpdated || "Not provided"}
            </p>
          </section>
          <section>
            <h2 className="font-bold text-[#20252b] dark:text-white">
              {t("support")}
            </h2>
            <p className="mt-2 text-sm text-[#53606c] dark:text-slate-300">
              Data Protection / Grievance Officer
            </p>
            {settings.grievanceOfficerName ? (
              <p className="mt-1 text-sm text-[#53606c] dark:text-slate-300">
                {settings.grievanceOfficerName}
              </p>
            ) : null}
            {settings.grievanceOfficerEmail ? (
              <a
                href={`mailto:${settings.grievanceOfficerEmail}`}
                className="mt-1 block break-all text-sm text-[#354f68] underline dark:text-sky-300"
              >
                {settings.grievanceOfficerEmail}
              </a>
            ) : null}
            {settings.grievanceOfficerPhone ? (
              <p className="mt-1 text-sm text-[#53606c] dark:text-slate-300">
                {settings.grievanceOfficerPhone}
              </p>
            ) : null}
            <button
              onClick={() => setReportOpen(true)}
              className="mt-4 rounded-lg bg-[#263746] px-3 py-2 text-xs font-semibold text-white"
            >
              {t("report")}
            </button>
          </section>
        </div>
        <div className="border-t border-[#e8ebee] dark:border-slate-800">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-4 text-xs text-[#697582] dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>
              © {new Date().getFullYear()}{" "}
              {settings.schoolName ?? "Certificate Portal"}
            </span>
            <span>
              This site uses essential security and session cookies only.
            </span>
          </div>
        </div>
      </footer>
      {reportOpen ? (
        <ReportWrongRecordModal onClose={() => setReportOpen(false)} />
      ) : null}
    </div>
  );
}
