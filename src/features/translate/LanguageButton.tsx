"use client";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import IconButton from "@/components/ui/IconButton";

import { usePageTranslation } from "./use-page-translation";

export default function LanguageButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const translation = usePageTranslation(pathname);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", keydown);
    };
  }, []);

  const current = translation.languages.find((item) => item.code === translation.selected)?.name ?? translation.selected;
  return (
    <div className="relative" ref={menuRef}>
      <IconButton
        label={`Choose page language. Current language: ${current}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void translation.loadLanguages();
        }}
      >
        <Languages size={19} aria-hidden="true" />
      </IconButton>
      {open && (
        <div role="menu" aria-label="Choose page language" className="absolute right-0 top-[calc(100%+8px)] z-[80] max-h-[min(70vh,24rem)] w-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] shadow-xl">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {translation.loadingLanguages ? "Loading supported languages..." : translation.loadingTranslation ? "Translating page..." : "Translate page"}
          </p>
          {translation.languages.map((language) => (
            <button
              key={language.code}
              type="button"
              role="menuitemradio"
              aria-checked={translation.selected === language.code}
              disabled={translation.loadingLanguages || translation.loadingTranslation}
              onClick={() => {
                translation.chooseLanguage(language.code);
                setOpen(false);
              }}
              className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${translation.selected === language.code ? "font-bold" : ""}`}
            >
              {language.name}
              {translation.selected === language.code ? <span aria-hidden="true">&#10003;</span> : null}
            </button>
          ))}
          {translation.message && <p role="status" className="px-3 py-2 text-xs text-[var(--danger)]">{translation.message}</p>}
          <p className="border-t border-[var(--border)] px-3 py-2 text-[10px] leading-4 text-[var(--text-muted)]">
            Translations are provided by Google Cloud Translation.
          </p>
        </div>
      )}
      <div aria-live="polite" className="sr-only">{translation.message}</div>
    </div>
  );
}
