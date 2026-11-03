"use client";

import { isLocaleCode, SUPPORTED_LOCALES, useLocale, useT } from "@/i18n/locale-provider";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

const languageNames: Record<(typeof SUPPORTED_LOCALES)[number], string> = {
  en: "English", hi: "हिन्दी", bn: "বাংলা", mr: "मराठी", gu: "ગુજરાતી",
  pa: "ਪੰਜਾਬੀ", ta: "தமிழ்", te: "తెలుగు", ur: "اردو",
};

export default function LanguageButton() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const settings = usePublicSiteSettings();
  const included = new Set((settings.includedLanguages ?? "en,hi,bn,mr,gu,pa,ta,te,ur")
    .split(",").map((code) => code.trim().toLowerCase()));
  const options = SUPPORTED_LOCALES.filter((code) => included.has(code));

  return (
    <label htmlFor="language-toggle" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]">
      <span className="sr-only">{t("nav.language")}</span>
      <select
        id="language-toggle"
        aria-label={t("nav.language")}
        value={locale}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (isLocaleCode(next)) setLocale(next);
        }}
        className="max-w-32 cursor-pointer bg-transparent outline-none"
      >
        {options.map((code) => <option key={code} value={code}>{languageNames[code]}</option>)}
      </select>
    </label>
  );
}
