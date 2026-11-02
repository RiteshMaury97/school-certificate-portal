import { BookOpenCheck, HeartHandshake, ShieldCheck } from "lucide-react";
import Image from "next/image";

import type { PublicSiteSettings } from "@/lib/use-site-settings";

function settingOr(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export default function AdminAuthBrandPanel({ settings }: { settings: PublicSiteSettings }) {
  const schoolName = settingOr(settings.schoolName, "Satyam International School");
  const schoolAddress = settingOr(settings.address, "Lodipur, Zamania, Ghazipur, Uttar Pradesh");
  const schoolTagline = settingOr(settings.tagline, "Education · Inspiration · Innovation");
  const logoUrl = settings.logoUrl?.trim();

  return (
    <section className="relative isolate overflow-hidden bg-[#14251e] px-6 py-6 text-white sm:px-10 lg:flex lg:min-h-dvh lg:flex-col lg:px-12 lg:py-9 xl:px-16 xl:py-12">
      <div aria-hidden="true" className="absolute -right-40 top-16 -z-10 h-[34rem] w-[34rem] rounded-full border border-white/[0.07]" />
      <div aria-hidden="true" className="absolute -right-24 top-32 -z-10 h-[25rem] w-[25rem] rounded-full border border-[#d8ad58]/20" />
      <div aria-hidden="true" className="absolute -bottom-48 -left-40 -z-10 h-[32rem] w-[32rem] rounded-full bg-[#28533f]/35 blur-3xl" />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#d8ad58] bg-white p-1">
          {logoUrl ? (
            <Image src={logoUrl} alt={`${schoolName} logo`} width={32} height={32} unoptimized className="h-full w-full rounded-full object-contain" />
          ) : (
            <span className="grid h-full w-full place-items-center rounded-full border border-[#51216d] text-[10px] font-bold text-[#51216d]">SIS</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#e6bd69]">School administration</p>
          <p className="mt-0.5 truncate text-sm font-medium text-white/90">{schoolName}</p>
        </div>
      </div>

      <div className="mx-auto mt-7 w-full max-w-2xl lg:my-auto lg:py-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/65">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e6bd69]" /> {schoolAddress}
        </p>
        <h2 className="mt-5 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:mt-8 lg:text-5xl xl:text-6xl">
          A place to learn,<br className="hidden sm:block" /> lead and grow.
        </h2>
        <p className="mt-4 max-w-lg text-sm leading-6 text-white/65 sm:text-base">A secure space for school administration. Manage student records, approvals and certificates with confidence.</p>
        <div className="mt-6 text-[10px] font-medium uppercase tracking-[0.16em] text-[#e6bd69]">{schoolTagline}</div>

        <div className="mt-7 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-3">
          {[
            { icon: BookOpenCheck, title: "Academic", detail: "excellence" },
            { icon: HeartHandshake, title: "Student-first", detail: "care" },
            { icon: ShieldCheck, title: "Secure", detail: "operations" },
          ].map(({ icon: Icon, title, detail }) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/[0.055] p-3 sm:p-4">
              <Icon size={17} className="text-[#e6bd69]" aria-hidden="true" />
              <p className="mt-3 text-[11px] font-semibold text-white/90 sm:text-xs">{title}</p>
              <p className="text-[10px] text-white/55 sm:mt-0.5">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="mt-7 text-[10px] leading-5 text-white/45 lg:mt-0">
        <p>{schoolName}</p>
        <p>{schoolAddress}</p>
      </footer>
    </section>
  );
}
