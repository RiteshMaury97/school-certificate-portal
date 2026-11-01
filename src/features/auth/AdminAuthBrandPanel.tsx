import Image from "next/image";

import type { PublicSiteSettings } from "@/lib/use-site-settings";

function settingOr(value: string | undefined, fallback: string): string {
  if (value?.trim()) return value.trim();
  return fallback;
}

export default function AdminAuthBrandPanel({ settings }: { settings: PublicSiteSettings }) {
  const schoolName = settingOr(settings.schoolName, "Satyam International School");
  const schoolAddress = settingOr(settings.address, "Lodipur, Zamania, Ghazipur, Uttar Pradesh");
  const schoolTagline = settingOr(settings.tagline, "Education · Inspiration · Innovation");
  const logoUrl = settings.logoUrl?.trim();

  return (
    <section className="relative hidden h-full min-h-0 overflow-hidden bg-[#14251e] px-10 py-8 text-white lg:flex lg:flex-col xl:px-16 xl:py-10">
      <div aria-hidden="true" className="absolute -right-36 top-24 h-96 w-96 rounded-full border border-white/10" />
      <div aria-hidden="true" className="absolute -right-20 top-40 h-64 w-64 rounded-full border border-[#d8ad58]/25" />
      <p className="relative text-[10px] font-medium uppercase tracking-[0.2em] text-white/65">{schoolName}</p>
      <div className="relative mt-12 flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-[#d8ad58] bg-white p-2 shadow-xl">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={`${schoolName} logo`}
            width={80}
            height={80}
            unoptimized
            className="h-full w-full rounded-full object-contain"
          />
        ) : (
          <span className="grid h-full w-full place-items-center rounded-full border-4 border-[#51216d] text-xl font-semibold text-[#51216d]">SIS</span>
        )}
      </div>
      <h2 className="relative mt-7 max-w-lg text-4xl font-medium leading-tight tracking-tight xl:text-5xl">{schoolName}</h2>
      <p className="relative mt-4 text-sm font-medium uppercase tracking-[0.12em] text-[#e6bd69]">
        Lodipur <span className="px-1 text-white/40">·</span> Zamania <span className="px-1 text-white/40">·</span> Ghazipur
      </p>
      <p className="relative mt-4 text-sm text-white/75">{schoolTagline}</p>
      <div className="relative mt-6 h-px w-full max-w-xl bg-white/10" />
      <h3 className="relative mt-7 text-2xl font-medium leading-snug xl:text-3xl">A place to learn, lead<br />and grow.</h3>
      <p className="relative mt-4 max-w-sm text-sm leading-6 text-white/65">A secure space for school administration. Manage student records, approvals and certificates with confidence.</p>
      <div className="relative mt-auto grid max-w-xl grid-cols-3 gap-3 pt-10">
        {[["01", "Academic excellence"], ["02", "Student-first care"], ["03", "Secure operations"]].map(([number, label]) => (
          <div key={number} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
            <span className="text-[10px] font-semibold tracking-wide text-[#e6bd69]">{number}</span>
            <p className="mt-3 text-xs leading-5 text-white/85">{label}</p>
          </div>
        ))}
      </div>
      <footer className="relative mt-8 text-[10px] leading-5 text-white/50">
        <p>{settingOr(settings.schoolName, "sischool.in")}</p>
        <p>{schoolAddress}</p>
      </footer>
    </section>
  );
}
