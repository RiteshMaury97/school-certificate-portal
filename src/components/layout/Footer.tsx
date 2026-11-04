"use client";

import Link from "next/link";
import { Facebook, Instagram, Link2, Linkedin, Twitter, Youtube } from "lucide-react";

import Logo from "@/components/ui/Logo";
import { useT } from "@/i18n/locale-provider";
import { SCHOOL_INFO } from "@/lib/school-info";
import { SITE_MAP } from "@/shared/site-map";

import type { SiteMapGroup } from "@/shared/site-map";

type Props = {
  schoolName?: string | undefined;
  tagline?: string | undefined;
  address?: string | undefined;
  affiliation?: string | undefined;
  boardName?: string | undefined;
  schoolCode?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  officeHours?: string | undefined;
  lastUpdated?: string | undefined;
  statusPageUrl?: string | undefined;
  socialLinks?: { label: string; url: string }[] | undefined;
  onReport?: (() => void) | undefined;
};

const linkClass =
  "text-[var(--text-muted)] transition-colors hover:text-[var(--primary)]";

function SchoolLogo() {
  return <Logo size={40} className="h-10 w-10 rounded-full bg-white object-contain p-0.5" />;
}

function SchoolStatus({ schoolCode, statusPageUrl }: Pick<Props, "schoolCode" | "statusPageUrl">) {
  const t = useT();
  if (!schoolCode?.trim() && !statusPageUrl?.trim()) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
      {schoolCode?.trim() && (
        <span>
          {t("footer.schoolCode")}: {schoolCode}
        </span>
      )}
      {statusPageUrl?.trim() && (
        <a href={statusPageUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
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
  socialLinks,
}: Pick<
  Props,
  | "schoolName"
  | "tagline"
  | "address"
  | "affiliation"
  | "boardName"
  | "schoolCode"
  | "statusPageUrl"
  | "socialLinks"
>) {
  const t = useT();
  const cleanAddress = address?.trim() ?? "";
  const displayAddress = cleanAddress.length > 0 ? cleanAddress : SCHOOL_INFO.address;

  return (
    <section className="footer-column min-w-0">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] shadow-sm">
          <SchoolLogo />
        </div>
        <div className="min-w-0">
          <h2
            translate="no"
            className="whitespace-normal break-words text-sm font-extrabold uppercase tracking-[0.08em]"
          >
            {schoolName}
          </h2>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {[affiliation, boardName]
              .filter(Boolean)
              .join("\u00b7")
              .replace(/^$/, t("footer.schoolManagement"))}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{tagline}</p>
      <address className="mt-5 not-italic">
        <p className="whitespace-pre-line text-sm leading-6 text-[var(--text)]">{displayAddress}</p>
      </address>
      <SchoolStatus schoolCode={schoolCode} statusPageUrl={statusPageUrl} />
      <SocialLinks links={socialLinks} />
    </section>
  );
}

const groupTranslationKeys = {
  School: "siteMap.groups.school",
  Certificates: "siteMap.groups.certificates",
  "Help and support": "siteMap.groups.helpAndSupport",
  "Legal and privacy": "siteMap.groups.legalAndPrivacy",
} as const;

function SiteMapLinks({ group }: { group: SiteMapGroup }) {
  const t = useT();
  const pages = SITE_MAP.filter((page) => page.group === group);
  if (pages.length === 0) return null;

  return (
    <nav aria-label={t(groupTranslationKeys[group])} className="footer-column">
      <h2 className="text-sm font-bold tracking-tight">{t(groupTranslationKeys[group])}</h2>
      <ul className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
        {pages.map((page) => (
          <li key={page.path}>
            <Link className={linkClass} href={page.path}>
              {t(page.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function QuickLinks() {
  return (
    <div className="space-y-6">
      <SiteMapLinks group="School" />
      <SiteMapLinks group="Certificates" />
    </div>
  );
}

function SupportLinks({
  onReport,
  phone,
  officeHours,
  email,
  website,
}: Pick<Props, "onReport" | "phone" | "officeHours" | "email" | "website">) {
  const t = useT();
  return (
    <section className="footer-column">
      <SiteMapLinks group="Help and support" />
      {onReport && (
        <button
          type="button"
          onClick={onReport}
          className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--primary)]"
        >
          {t("footer.reportWrongRecord")} <span aria-hidden="true">→</span>
        </button>
      )}
      <div className="mt-4 space-y-3 text-sm text-[var(--text-muted)]">
        <p>{t("footer.needHelp")}</p>
        {(phone?.trim() || email?.trim() || website?.trim() || officeHours?.trim()) && (
          <address className="not-italic">
            <h3 className="mb-2 text-xs font-bold text-[var(--text)]">
              {t("footer.contactSchool")}
            </h3>
            <dl className="space-y-2.5 text-xs leading-5">
              {phone?.trim() && (
                <div>
                  <dt className="font-semibold text-[var(--text)]">Phone</dt>
                  <dd>
                    <a className={linkClass} href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                      {phone}
                    </a>
                  </dd>
                </div>
              )}
              {email?.trim() && (
                <div>
                  <dt className="font-semibold text-[var(--text)]">Email</dt>
                  <dd>
                    <a className={`${linkClass} break-all`} href={`mailto:${email}`}>
                      {email}
                    </a>
                  </dd>
                </div>
              )}
              {website?.trim() && (
                <div>
                  <dt className="font-semibold text-[var(--text)]">Official website</dt>
                  <dd>
                    <a
                      className={`${linkClass} break-all`}
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
                    </a>
                  </dd>
                </div>
              )}
              {officeHours?.trim() && (
                <div>
                  <dt className="font-semibold text-[var(--text)]">Office hours</dt>
                  <dd>{officeHours}</dd>
                </div>
              )}
            </dl>
          </address>
        )}
      </div>
    </section>
  );
}

function LegalLinks() {
  return <SiteMapLinks group="Legal and privacy" />;
}

function SocialLinks({ links }: { links: Props["socialLinks"] }) {
  const t = useT();
  const visibleSocialLinks = links?.filter((item) => item.label.trim() && item.url.trim()) ?? [];
  if (!visibleSocialLinks.length) return null;

  return (
    <nav aria-label="Social media links" className="footer-column mt-6">
      <h2 className="text-xs font-medium text-[var(--text-muted)]">{t("footer.connect")}</h2>
      <ul className="mt-3 flex flex-wrap gap-2.5">
        {visibleSocialLinks.map((item, index) => {
          const label = item.label.toLowerCase();
          const Icon = label.includes("facebook")
            ? Facebook
            : label.includes("instagram")
              ? Instagram
              : label.includes("linkedin")
                ? Linkedin
                : label.includes("youtube")
                  ? Youtube
                  : label.includes("twitter") || label === "x"
                    ? Twitter
                    : Link2;
          return (
            <li key={`${item.label}-${String(index)}`}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                title={item.label}
                className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white transition-colors hover:border-white/35 hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function FooterAttribution({ schoolName, lastUpdated }: Pick<Props, "schoolName" | "lastUpdated">) {
  const t = useT();
  return (
    <div className="border-t border-[var(--border)]">
      <div className="flex w-full flex-col gap-2 px-5 py-4 text-[10px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 xl:px-16">
        <span>
          © {new Date().getFullYear()} {schoolName}. {t("footer.allRightsReserved")}
        </span>
        {lastUpdated?.trim() && (
          <span>
            {t("footer.lastUpdated")} {lastUpdated}
          </span>
        )}
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
  website,
  officeHours,
  lastUpdated,
  statusPageUrl,
  socialLinks,
  onReport,
}: Props) {
  return (
    <footer className="public-footer relative mx-2 my-2 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/50 to-transparent"
      />
      <div className="relative grid w-full gap-10 px-6 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.6fr_0.85fr_1.15fr_1fr] lg:gap-10 lg:px-10 lg:py-12 xl:px-14">
        <SchoolIdentity
          schoolName={schoolName}
          tagline={tagline}
          address={address}
          affiliation={affiliation}
          boardName={boardName}
          schoolCode={schoolCode}
          statusPageUrl={statusPageUrl}
          socialLinks={socialLinks}
        />
        <QuickLinks />
        <SupportLinks
          onReport={onReport}
          phone={phone}
          officeHours={officeHours}
          email={email}
          website={website}
        />
        <LegalLinks />
      </div>
      <FooterAttribution schoolName={schoolName} lastUpdated={lastUpdated} />
    </footer>
  );
}
