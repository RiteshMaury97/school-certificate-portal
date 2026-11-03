"use client";

import Link from "next/link";

import Logo from "@/components/ui/Logo";
import { SCHOOL_INFO } from "@/lib/school-info";
import { useT } from "@/i18n/locale-provider";

type Props = {
  schoolName?: string | undefined;
  tagline?: string | undefined;
  address?: string | undefined;
  affiliation?: string | undefined;
  boardName?: string | undefined;
  schoolCode?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  officeHours?: string | undefined;
  lastUpdated?: string | undefined;
  statusPageUrl?: string | undefined;
  socialLinks?: { label: string; url: string }[] | undefined;
  onReport?: (() => void) | undefined;
};

const linkClass =
  "transition-colors hover:text-[var(--primary)] hover:underline hover:underline-offset-4";

function SchoolLogo() {
  return <Logo size={40} className="h-10 w-10 rounded-full bg-white object-contain p-0.5" />;
}

function SchoolStatus({
  schoolCode,
  statusPageUrl,
}: Pick<Props, "schoolCode" | "statusPageUrl">) {
  const t = useT();
  if (!schoolCode?.trim() && !statusPageUrl?.trim()) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
      {schoolCode?.trim() && <span>{t("footer.schoolCode")}: {schoolCode}</span>}
      {statusPageUrl?.trim() && (
        <a
          href={statusPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {t("footer.systemStatus")} ↗
        </a>
      )}
    </div>
  );
}

function SchoolIdentity({
  schoolName,
  tagline,
  address,
  affiliation,
  boardName,
  schoolCode,
  statusPageUrl,
}: Pick<
  Props,
  | "schoolName"
  | "tagline"
  | "address"
  | "affiliation"
  | "boardName"
  | "schoolCode"
  | "statusPageUrl"
>) {
  const t = useT();
  return (
    <section className="min-w-0">
      <div className="flex items-center gap-2.5">
        <SchoolLogo />
        <div className="min-w-0">
          <h2 translate="no" className="whitespace-normal break-words text-sm font-bold uppercase tracking-wide">
            {schoolName}
          </h2>
          <p className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--text-muted)]">
            {[affiliation, boardName].filter(Boolean).join("\u00b7").replace(/^$/, t("footer.schoolManagement"))}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold text-[var(--text)]">{tagline}</p>
      {(address?.trim() || SCHOOL_INFO.address) && (
        <p className="mt-4 whitespace-pre-line text-xs leading-5 text-[var(--text-muted)]">
          {address?.trim() || SCHOOL_INFO.address}
        </p>
      )}
      <SchoolStatus schoolCode={schoolCode} statusPageUrl={statusPageUrl} />
    </section>
  );
}

function QuickLinks() {
  const t = useT();
  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/certificates", label: t("footer.findCertificates") },
    { href: "/verify", label: t("footer.verifyCertificate") },
    { href: "/faq", label: t("footer.faq") },
    { href: "/contact", label: t("footer.contactSchool") },
  ];

  return (
    <nav aria-label="Quick links">
      <h2 className="text-sm font-bold">{t("footer.quickLinks")}</h2>
      <ul className="mt-3 space-y-2 text-xs text-[var(--text-muted)]">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link className={linkClass} href={href}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SupportLinks({ onReport, phone, officeHours, email }: Pick<Props, "onReport" | "phone" | "officeHours" | "email">) {
  const t = useT();
  return (
    <section>
      <h2 className="text-sm font-bold">{t("footer.support")}</h2>
      {onReport && (
        <button
          type="button"
          onClick={onReport}
          className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--primary)]"
        >
          {t("footer.reportWrongRecord")} <span aria-hidden="true">→</span>
        </button>
      )}
      <div className="mt-3 space-y-2 text-xs text-[var(--text-muted)]">
        <p>{t("footer.needHelp")}</p>
        {phone?.trim() && (
          <p>
            <a className="font-semibold text-[var(--text)] hover:underline" href={`tel:${phone}`}>
              {phone}
            </a>
          </p>
        )}
        {officeHours?.trim() && <p>{officeHours}</p>}
        {email?.trim() && (
          <p>
            <a className="break-all hover:underline" href={`mailto:${email}`}>
              {email}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}

function LegalLinks() {
  const t = useT();
  const links = [
    { href: "/terms", label: t("footer.terms") },
    { href: "/privacy", label: t("footer.privacy") },
    { href: "/data-rights", label: t("footer.dataRights") },
  ];

  return (
    <nav aria-label="Legal links">
      <h2 className="text-sm font-bold">{t("footer.legal")}</h2>
      <ul className="mt-3 space-y-2 text-xs text-[var(--text-muted)]">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link className={linkClass} href={href}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SocialLinks({ links }: { links: Props["socialLinks"] }) {
  const t = useT();
  const visibleLinks = links?.filter((item) => item.label.trim() && item.url.trim()) ?? [];
  if (!visibleLinks.length) return null;

  return (
    <nav aria-label="Social links" className="sm:col-span-2 lg:col-span-4">
      <h2 className="text-sm font-bold">{t("footer.connect")}</h2>
      <ul className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
        {visibleLinks.map((item, index) => (
          <li key={`${item.label}-${String(index)}`}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FooterAttribution({
  schoolName,
  lastUpdated,
}: Pick<Props, "schoolName" | "lastUpdated">) {
  const t = useT();
  return (
    <div className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-[10px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>
          © {new Date().getFullYear()} {schoolName}. {t("footer.allRightsReserved")}
        </span>
        {lastUpdated?.trim() && <span>{t("footer.lastUpdated")} {lastUpdated}</span>}
        <span className="font-medium text-[var(--text)]">{t("footer.officialServices")}</span>
      </div>
    </div>
  );
}

export default function Footer({
  schoolName = "Satyam International School",
  tagline = "Educate. Elevate. Empower.",
  address,
  affiliation,
  boardName,
  schoolCode,
  email,
  phone,
  officeHours,
  lastUpdated,
  statusPageUrl,
  socialLinks,
  onReport,
}: Props) {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
      <div className="mx-auto grid max-w-6xl gap-9 px-4 py-9 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.35fr_1fr_1.2fr_1fr] lg:gap-12 lg:px-8 lg:py-10">
        <SchoolIdentity
          schoolName={schoolName}
          tagline={tagline}
          address={address}
          affiliation={affiliation}
          boardName={boardName}
          schoolCode={schoolCode}
          statusPageUrl={statusPageUrl}
        />
        <QuickLinks />
        <SupportLinks onReport={onReport} phone={phone} officeHours={officeHours} email={email} />
        <LegalLinks />
        <SocialLinks links={socialLinks} />
      </div>
      <FooterAttribution
        schoolName={schoolName}
        lastUpdated={lastUpdated}
      />
    </footer>
  );
}
