"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import english from "./messages/en.json";

import type { ReactNode } from "react";

export const SUPPORTED_LOCALES = ["en", "hi", "bn", "mr", "gu", "pa", "ta", "te", "ur"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
type Messages = typeof english;
type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; messages: Messages };

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessages(value: unknown): value is Messages {
  return isRecord(value) && isRecord(value.nav) && isRecord(value.home);
}

const localeLoaders: Record<Exclude<Locale, "en">, () => Promise<{ default: unknown }>> = {
  hi: () => import("./messages/hi.json"),
  bn: () => import("./messages/bn.json"),
  mr: () => import("./messages/mr.json"),
  gu: () => import("./messages/gu.json"),
  pa: () => import("./messages/pa.json"),
  ta: () => import("./messages/ta.json"),
  te: () => import("./messages/te.json"),
  ur: () => import("./messages/ur.json"),
};

export function isLocaleCode(value: string): value is Locale {
  for (const locale of SUPPORTED_LOCALES) if (locale === value) return true;
  return false;
}

const LOCALE_EVENT = "sis-locale-change";
let memoryLocale: Locale = "en";
function subscribeLocale(callback: () => void) {
  window.addEventListener(LOCALE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LOCALE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function currentLocale(): Locale {
  try {
    const saved = window.localStorage.getItem("sis-locale");
    return saved && isLocaleCode(saved) ? saved : memoryLocale;
  } catch {
    return memoryLocale;
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, (): Locale => "en");
  const pathname = usePathname();
  const activeLocale = pathname.startsWith("/admin") ? "en" : locale;
  const [catalog, setCatalog] = useState<{ locale: Locale; messages: Messages }>({ locale: "en", messages: english });
  const messages = activeLocale === "en" || catalog.locale !== activeLocale ? english : catalog.messages;

  const setLocale = useCallback((next: Locale) => {
    memoryLocale = next;
    try {
      window.localStorage.setItem("sis-locale", next);
    } catch {
      // The language can still be changed for this page view.
    }
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }, []);

  useEffect(() => {
    let active = true;
    document.documentElement.lang = activeLocale;
    document.documentElement.dir = activeLocale === "ur" ? "rtl" : "ltr";
    document.documentElement.dataset.locale = activeLocale;
    if (activeLocale === "en") return () => { active = false; };
    const loadLocale = localeLoaders[activeLocale];
    void loadLocale().then(({ default: loaded }) => {
      if (active && isMessages(loaded)) setCatalog({ locale: activeLocale, messages: loaded });
    }).catch(() => {
      // The lookup hook falls back to English for any missing message.
    });
    return () => { active = false; };
  }, [activeLocale]);

  const value = useMemo(() => ({ locale, setLocale, messages }), [locale, setLocale, messages]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider.");
  return context;
}

export function useT() {
  const { messages } = useLocale();
  return useCallback((key: string): string => {
    const parts = key.split(".");
    let value: unknown = messages;
    let fallback: unknown = english;
    for (const part of parts) {
      if (isRecord(value) && part in value) value = value[part];
      else value = undefined;
      if (isRecord(fallback) && part in fallback) fallback = fallback[part];
      else fallback = undefined;
    }
    return typeof value === "string" ? value : typeof fallback === "string" ? fallback : key;
  }, [messages]);
}
