"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import ReportWrongRecordModal from "@/features/report/ReportWrongRecordModal";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

import type { PublicSiteSettings } from "@/lib/use-site-settings";

function displaySchoolName(name: string | undefined): string {
  if (name?.trim()) return name.trim();
  return "Satyam International School";
}

function useAnnouncementDismissal() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setDismissed(sessionStorage.getItem("sis-announcement-dismissed") === "true");
      } catch {
        setDismissed(false);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);
  return [dismissed, setDismissed] as const;
}

function useServiceWorkerMaintenance() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => null);
      return;
    }
    void navigator.serviceWorker
      .getRegistrations()
      .then((items) => Promise.all(items.map((item) => item.unregister())))
      .catch(() => null);
    void caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => name.startsWith("sis-static-")).map((name) => caches.delete(name)),
        ),
      )
      .catch(() => null);
  }, []);
}

function AnnouncementBanner({
  announcement,
  text,
  onDismiss,
}: {
  announcement: NonNullable<PublicSiteSettings["announcement"]>;
  text: string;
  onDismiss: () => void;
}) {
  return (
    <aside
      role="status"
      aria-live="polite"
      className={`border-b px-4 py-3 text-sm ${announcement.type === "warning" ? "border-[var(--warning)] bg-[var(--surface-2)] text-[var(--text)]" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"}`}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1">
          {text}
          {announcement.linkUrl && (
            <a
              href={announcement.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 font-semibold underline underline-offset-4"
            >
              View announcement details
            </a>
          )}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className="min-h-11 rounded-lg border border-[var(--border)] px-3 font-semibold"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}

function SchoolMetadata({ settings }: { settings: PublicSiteSettings }) {
  const fields = [
    { label: "Board / Affiliation", value: settings.boardName },
    { label: "Affiliation number", value: settings.affiliationNumber },
    { label: "School code", value: settings.schoolCode },
  ].filter((field) => field.value?.trim());
  if (!fields.length) return null;

  return (
    <section className="border-b border-[var(--border)] bg-[var(--surface-2)]">
      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-3 text-xs sm:grid-cols-3 sm:px-6 lg:px-8">
        {fields.map((field) => (
          <div key={field.label}>
            <span className="block text-[var(--text-muted)]">{field.label}</span>
            <strong className="mt-1 block text-sm">{field.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function PrincipalMessage({ settings }: { settings: PublicSiteSettings }) {
  if (!settings.principalMessage?.trim()) return null;

  return (
    <section className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-9 sm:grid-cols-[180px_1fr] sm:items-center sm:px-6 lg:px-8">
        <div className="mx-auto h-36 w-36 overflow-hidden rounded-full bg-[var(--surface-2)] sm:mx-0">
          {settings.principalPhotoUrl && (
            <Image
              src={settings.principalPhotoUrl}
              alt={settings.principalName ? `Photo of ${settings.principalName}` : "Principal"}
              width={144}
              height={144}
              unoptimized
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
  );
}

export default function SiteShell({ children }: { children: ReactNode }) {
  const settings = usePublicSiteSettings();
  const [announcementDismissed, setAnnouncementDismissed] = useAnnouncementDismissal();
  const [reportOpen, setReportOpen] = useState(false);
  const pathname = usePathname();
  useServiceWorkerMaintenance();

  const announcement = settings.announcement;
  const announcementText = announcement?.textEn.trim();
  const schoolName = displaySchoolName(settings.schoolName);

  return (
    <div className="site-frame flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      <Header
        schoolName={schoolName}
      />
      {pathname === "/" && announcement && !announcementDismissed && announcementText && (
        <AnnouncementBanner
          announcement={announcement}
          text={announcementText}
          onDismiss={() => {
            try {
              sessionStorage.setItem("sis-announcement-dismissed", "true");
            } catch {
              /* Session storage is optional. */
            }
            setAnnouncementDismissed(true);
          }}
        />
      )}
      <SchoolMetadata settings={settings} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      >
        {children}
      </main>
      {pathname === "/" && <PrincipalMessage settings={settings} />}
      <Footer
        schoolName={schoolName}
        tagline={settings.tagline}
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
        onReport={() => {
          setReportOpen(true);
        }}
      />
      {reportOpen && (
        <ReportWrongRecordModal
          onClose={() => {
            setReportOpen(false);
          }}
        />
      )}
    </div>
  );
}
