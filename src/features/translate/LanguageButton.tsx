"use client";

import { ChevronDown, Languages } from "lucide-react";

import { isLocaleCode, SUPPORTED_LOCALES, useLocale, useT } from "@/i18n/locale-provider";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

const languageNames: Record<(typeof SUPPORTED_LOCALES)[number], string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
  ta: "Tamil",
  te: "Telugu",
  ur: "Urdu",
};

export default function LanguageButton() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const settings = usePublicSiteSettings();
  const included = new Set((settings.includedLanguages ?? "en,hi,bn,mr,gu,pa,ta,te,ur")
    .split(",").map((code) => code.trim().toLowerCase()));
  const options = SUPPORTED_LOCALES.filter((code) => included.has(code));

  return (
    <label
      htmlFor="language-toggle"
      className="group relative inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--border)]/70 bg-[var(--surface)] py-1 pl-1.5 pr-3 text-[var(--text)] shadow-sm transition-all duration-200 hover:border-[var(--primary)] hover:shadow-md focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]"
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)] transition-colors group-hover:bg-[var(--primary)] group-hover:text-[var(--on-primary)]"
        aria-hidden="true"
      >
        <Languages size={16} strokeWidth={1.9} />
      </span>
      <select
        id="language-toggle"
        aria-label={t("nav.language")}
        value={locale}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (isLocaleCode(next)) setLocale(next);
        }}
        style={{ border: "none", outline: "none", boxShadow: "none" }}
        className="h-9 min-w-[4.5rem] max-w-28 cursor-pointer appearance-none border-0 bg-transparent p-0 pr-4 text-[13px] font-semibold leading-none text-[var(--text)] outline-none"
      >
        {options.map((code) => <option key={code} value={code}>{languageNames[code]}</option>)}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 text-[var(--text-muted)] transition-transform duration-200 group-focus-within:rotate-180"
        aria-hidden="true"
      />
    </label>
  );
}
