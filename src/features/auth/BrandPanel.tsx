import { Globe, Mail, MapPin, Phone } from "lucide-react";

import Logo from "@/components/ui/Logo";
import { SCHOOL_INFO } from "@/lib/school-info";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

import { OFFICIAL_WEBSITE } from "../../../config/school";

type ContactItem = {
  label: string;
  value: string;
  href?: string;
  Icon: typeof MapPin;
  external?: boolean;
};

function ContactList({ className, contacts }: { className?: string; contacts: ContactItem[] }) {
  return (
    <ul className={className}>
      {contacts.map(({ label, value, href, Icon, external }) => (
        <li key={label} className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--gold)] text-[var(--text)]">
            <Icon aria-hidden="true" size={17} />
          </span>
          <span className="min-w-0 text-sm leading-5">
            <span className="mr-2 text-[var(--on-primary)]/85">{label}:</span>
            {href ? (
              <a
                className="font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--on-primary)]"
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {value}
              </a>
            ) : (
              <span className="font-medium">{value}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function BrandPanel() {
  const settings = usePublicSiteSettings();
  const email = settings.email?.trim() ?? "";
  const website = OFFICIAL_WEBSITE;
  const contacts: ContactItem[] = [
    { label: "Address", value: SCHOOL_INFO.address, Icon: MapPin },
    {
      label: "Phone",
      value: SCHOOL_INFO.phone,
      href: `tel:${SCHOOL_INFO.phone.replaceAll(" ", "")}`,
      Icon: Phone,
    },
    ...(email ? [{ label: "Email", value: email, href: `mailto:${email}`, Icon: Mail }] : []),
    ...(website
      ? [
          {
            label: "Website",
            value: "Visit Official Website",
            href: website,
            Icon: Globe,
            external: true,
          },
        ]
      : []),
  ];
  return (
    <aside className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] px-5 py-5 text-[var(--on-primary)] sm:px-8 lg:flex lg:min-h-dvh lg:items-center lg:px-12 lg:py-12 xl:px-16">
      <div className="mx-auto flex w-full max-w-xl items-center gap-4 lg:my-auto lg:flex-col lg:items-start lg:gap-0">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--surface)] p-1.5 shadow-sm lg:mb-7 lg:size-20">
          <Logo size={72} className="h-full w-full rounded-xl object-contain" />
        </div>
        <div className="min-w-0 lg:w-full">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--on-primary)] lg:mb-3 lg:text-xs">
            School Administration
          </p>
          <h1 className="text-xl font-semibold leading-tight tracking-tight lg:max-w-lg lg:text-4xl xl:text-[44px]">
            {SCHOOL_INFO.name}
          </h1>
          <p className="mt-2 text-xs leading-5 text-[var(--on-primary)]/85 lg:text-sm">
            {SCHOOL_INFO.address}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--on-primary)]/90">
            <a href={`tel:${SCHOOL_INFO.phone.replaceAll(" ", "")}`}>{SCHOOL_INFO.phone}</a>
            {email && <a href={`mailto:${email}`}>{email}</a>}
          </div>
          <p className="mt-2 hidden text-sm font-medium text-[var(--on-primary)] lg:block">
            Empowering Minds. Building Futures.
          </p>
        </div>

        <div className="hidden lg:block lg:w-full">
          <p className="mt-4 max-w-md text-sm leading-6 text-[var(--on-primary)]/85">
            Official school records and administration portal for managing student records, academic
            operations, and certificates.
          </p>
          <details open className="mt-8">
            <summary className="sr-only">School contact details</summary>
            <ContactList className="grid gap-4" contacts={contacts} />
          </details>
        </div>
      </div>
      <div className="mx-auto mt-4 w-full max-w-xl lg:hidden">
        <details className="rounded-xl border border-[var(--on-primary)]/25 bg-[var(--primary-hover)] p-3">
          <summary className="cursor-pointer text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--on-primary)]">
            School contact details
          </summary>
          <ContactList className="mt-4 grid gap-3" contacts={contacts} />
        </details>
      </div>
    </aside>
  );
}
