"use client";
import Link from "next/link";
type Props = {
  schoolName?: string;
  logoUrl?: string;
  address?: string;
  affiliation?: string;
  boardName?: string;
  schoolCode?: string;
  email?: string;
  phone?: string;
  officeHours?: string;
  lastUpdated?: string;
  statusPageUrl?: string;
  socialLinks?: { label: string; url: string }[];
  translationCookieUsed?: boolean;
  onReport?: () => void;
};
export default function Footer({
  schoolName = "Satyam International School",
  logoUrl,
  address,
  affiliation,
  boardName,
  schoolCode,
  email,
  phone,
  officeHours,
  lastUpdated,
  statusPageUrl,
  socialLinks = [],
  translationCookieUsed = false,
  onReport,
}: Props) {
  const hasSchool = Boolean(
    schoolName?.trim() ||
    logoUrl?.trim() ||
    address?.trim() ||
    affiliation?.trim() ||
    boardName?.trim() ||
    schoolCode?.trim(),
  );
  const hasSupport = Boolean(email?.trim() || phone?.trim() || officeHours?.trim() || onReport);
  const hasQuick = true;
  const hasLegal = true;
  const visibleSocialLinks = socialLinks.filter((item) => item.label?.trim() && item.url?.trim());
  const hasSocial = visibleSocialLinks.length > 0;
  return (
    <footer className="mt-10 border-t border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-9 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {hasSchool && (
          <section className="min-w-0">
            <h2 className="notranslate flex items-center gap-2 font-bold" translate="no">
              {logoUrl && (
                <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" />
              )}
              {schoolName}
            </h2>
            {address?.trim() && (
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--text-muted)]">
                {address}
              </p>
            )}
            {boardName?.trim() && (
              <p className="mt-2 text-sm text-[var(--text-muted)]">{boardName}</p>
            )}
            {affiliation?.trim() && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">Affiliation: {affiliation}</p>
            )}
            {schoolCode?.trim() && (
              <p className="mt-1 text-sm text-[var(--text-muted)]">School code: {schoolCode}</p>
            )}
            {statusPageUrl?.trim() && (
              <a
                href={statusPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-sm underline underline-offset-4"
              >
                System status
              </a>
            )}
          </section>
        )}
        {hasQuick && (
          <nav aria-label="Quick links">
            <h2 className="font-bold">Quick links</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/certificates">Find my certificates</Link>
              </li>
              <li>
                <Link href="/verify">Verify a certificate</Link>
              </li>
              <li>
                <Link href="/faq">FAQ</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
            </ul>
          </nav>
        )}
        {hasSupport && (
          <section>
            <h2 className="font-bold">Support</h2>
            <div className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              {email?.trim() && (
                <p>
                  <a className="break-all underline underline-offset-4" href={`mailto:${email}`}>
                    {email}
                  </a>
                </p>
              )}
              {phone?.trim() && (
                <p>
                  <a className="underline underline-offset-4" href={`tel:${phone}`}>
                    {phone}
                  </a>
                </p>
              )}
              {officeHours?.trim() && <p>Office hours: {officeHours}</p>}
              {onReport && (
                <button
                  type="button"
                  onClick={onReport}
                  className="min-h-11 rounded-lg border border-[var(--border)] px-3 font-semibold text-[var(--text)]"
                >
                  Report a wrong record
                </button>
              )}
            </div>
          </section>
        )}
        {hasLegal && (
          <nav aria-label="Legal links">
            <h2 className="font-bold">Legal</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
              <li>
                <Link href="/terms">Terms and Conditions</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/data-rights">Data rights</Link>
              </li>
            </ul>
          </nav>
        )}
        {hasSocial && (
          <nav aria-label="Social links" className="sm:col-span-2 lg:col-span-4">
            <h2 className="font-bold">Connect</h2>
            <ul className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
              {visibleSocialLinks.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            © {new Date().getFullYear()} {schoolName}
          </span>
          {lastUpdated?.trim() && <span>Last updated: {lastUpdated}</span>}
          {translationCookieUsed && (
            <span>
              The Google Translate functional cookie (googtrans) is set only after you choose a
              language.
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
