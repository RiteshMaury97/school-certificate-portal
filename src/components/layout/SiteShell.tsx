"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import ReportWrongRecordModal from "@/features/report/ReportWrongRecordModal";
type SiteSettings = {
  schoolName?: string;
  tagline?: string;
  logoUrl?: string;
  statusPageUrl?: string;
  announcement?: { type: "info" | "warning"; textEn: string; linkUrl: string } | null;
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
  lastUpdated?: string;
  includedLanguages?: string;
};
export default function SiteShell({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [translationCookieUsed, setTranslationCookieUsed] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      } else {
        void navigator.serviceWorker
          .getRegistrations()
          .then((items) => Promise.all(items.map((item) => item.unregister())))
          .catch(() => {});
        void caches
          .keys()
          .then((names) =>
            Promise.all(names.filter((n) => n.startsWith("sis-static-")).map((n) => caches.delete(n))),
          )
          .catch(() => {});
      }
    }
    try {
      setAnnouncementDismissed(sessionStorage.getItem("sis-announcement-dismissed") === "true");
    } catch {
      setAnnouncementDismissed(false);
    }
    setTranslationCookieUsed(
      document.cookie
        .split("; ")
        .some((cookie) => cookie.startsWith("googtrans=") && cookie.split("=")[1] !== ""),
    );
    const onTranslationChoice = (event: Event) => {
      const detail = (event as CustomEvent<{ cookieUsed: boolean }>).detail;
      const hasGoogleCookie = document.cookie
        .split("; ")
        .some((cookie) => cookie.startsWith("googtrans=") && cookie.split("=")[1] !== "");
      setTranslationCookieUsed((detail?.cookieUsed) && hasGoogleCookie);
    };
    window.addEventListener("sis-google-translate-choice", onTranslationChoice);

    let active = true;
    fetch("/api/public/site-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (active && data && typeof data.settings === "object" && data.settings)
          setSettings(data.settings as SiteSettings);
      })
      .catch(() => {});
    return () => {
      active = false;
      window.removeEventListener("sis-google-translate-choice", onTranslationChoice);
    };
  }, []);
  const announcementText = settings.announcement?.textEn?.trim();
  const schoolName = settings.schoolName?.trim() || "Satyam International School";
  const includedLanguages = settings.includedLanguages;
  return (
    <div className="site-frame flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      <Header
        schoolName={schoolName}
        logoUrl={settings.logoUrl}
        includedLanguages={includedLanguages}
      />
      {pathname === "/" &&
        settings.announcement &&
        !announcementDismissed &&
        announcementText && (
          <aside
            role="status"
            aria-live="polite"
            className={`border-b px-4 py-3 text-sm ${settings.announcement.type === "warning" ? "border-[var(--warning)] bg-[var(--surface-2)] text-[var(--text)]" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"}`}
          >
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1">
                {announcementText}
                {settings.announcement.linkUrl && (
                  <a
                    href={settings.announcement.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 font-semibold underline underline-offset-4"
                  >
                    Learn more
                  </a>
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem("sis-announcement-dismissed", "true");
                  } catch {
                    /* Session storage is optional. */
                  }
                  setAnnouncementDismissed(true);
                }}
                aria-label="Dismiss announcement"
                className="min-h-11 rounded-lg border border-[var(--border)] px-3 font-semibold"
              >
                Dismiss
              </button>
            </div>
          </aside>
        )}
      {(settings.boardName?.trim() ||
        settings.affiliationNumber?.trim() ||
        settings.schoolCode?.trim()) && (
        <section className="border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="mx-auto grid max-w-6xl gap-3 px-4 py-3 text-xs sm:grid-cols-3 sm:px-6 lg:px-8">
            {settings.boardName?.trim() && (
              <div>
                <span className="block text-[var(--text-muted)]">Board / Affiliation</span>
                <strong className="mt-1 block text-sm">{settings.boardName}</strong>
              </div>
            )}
            {settings.affiliationNumber?.trim() && (
              <div>
                <span className="block text-[var(--text-muted)]">Affiliation number</span>
                <strong className="mt-1 block text-sm">{settings.affiliationNumber}</strong>
              </div>
            )}
            {settings.schoolCode?.trim() && (
              <div>
                <span className="block text-[var(--text-muted)]">School code</span>
                <strong className="mt-1 block text-sm">{settings.schoolCode}</strong>
              </div>
            )}
          </div>
        </section>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      >
        {children}
      </main>
      {pathname === "/" && settings.principalMessage?.trim() && (
        <section className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-9 sm:grid-cols-[180px_1fr] sm:items-center sm:px-6 lg:px-8">
            <div className="mx-auto h-36 w-36 overflow-hidden rounded-full bg-[var(--surface-2)] sm:mx-0">
              {settings.principalPhotoUrl && (
                <img
                  src={settings.principalPhotoUrl}
                  alt={settings.principalName ? `Photo of ${settings.principalName}` : "Principal"}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">{"Principal’s Message"}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--text-muted)]">
                {settings.principalMessage}
              </p>
              {settings.principalName && (
                <p className="mt-3 font-semibold">{settings.principalName}</p>
              )}
            </div>
          </div>
        </section>
      )}
      <Footer
        schoolName={schoolName}
        tagline={settings.tagline}
        logoUrl={settings.logoUrl}
        address={settings.address}
        affiliation={settings.affiliationNumber}
        boardName={settings.boardName}
        schoolCode={settings.schoolCode}
        email={settings.email}
        phone={settings.phone}
        officeHours={settings.officeHours}
        lastUpdated={settings.lastUpdated}
        statusPageUrl={settings.statusPageUrl}
        socialLinks={settings.socialLinks}
        translationCookieUsed={translationCookieUsed}
        onReport={() => { setReportOpen(true); }}
      />
      {reportOpen && <ReportWrongRecordModal onClose={() => { setReportOpen(false); }} />}
    </div>
  );
}
