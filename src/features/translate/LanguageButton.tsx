"use client";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import IconButton from "@/components/ui/IconButton";

type Language = { code: string; name: string };
type TranslationCache = Map<string, string>;
type SavedText = { source: string; translated: string };

const ENGLISH: Language = { code: "en", name: "English" };
const LANGUAGES_URL = "/api/public/translation/languages";
const TRANSLATE_URL = "/api/public/translation/translate";

function readSavedLanguage(): string {
  try {
    return localStorage.getItem("sis-google-translate-language") || "en";
  } catch {
    return "en";
  }
}

function eligibleTextNodes(): Text[] {
  const excluded = "script,style,noscript,svg,textarea,input,select,option,[translate='no'],.notranslate,[aria-hidden='true'],[data-translate-ignore]";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    const value = node.nodeValue ?? "";
    if (!parent || !value.trim() || parent.closest(excluded) || parent.isContentEditable) continue;
    nodes.push(node);
  }
  return nodes;
}

export default function LanguageButton(_props: { includedLanguages?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("en");
  const [languages, setLanguages] = useState<Language[]>([ENGLISH]);
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [message, setMessage] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const activeLanguage = useRef("en");
  const runId = useRef(0);
  const textMap = useRef(new Map<Text, SavedText>());
  const cache = useRef<TranslationCache>(new Map());

  const loadLanguages = useCallback(async () => {
    if (languages.length > 1 || loadingLanguages) return;
    setLoadingLanguages(true);
    setMessage("");
    try {
      const response = await fetch(LANGUAGES_URL, { cache: "force-cache" });
      const data: unknown = await response.json();
      if (!response.ok) {
        if (response.status === 503) throw new Error("setup");
        throw new Error("languages");
      }
      if (typeof data !== "object" || data === null || !("languages" in data) || !Array.isArray(data.languages))
        throw new Error("languages");
      const supported = data.languages.filter((item): item is Language =>
        typeof item === "object" && item !== null && "code" in item && "name" in item &&
        typeof item.code === "string" && typeof item.name === "string",
      );
      setLanguages([ENGLISH, ...supported.filter((language) => language.code !== "en")]);
    } catch (error) {
      setMessage(error instanceof Error && error.message === "setup"
        ? "Translation needs a Google Cloud API key. Ask the site administrator to configure it."
        : "Could not load Google’s supported languages. Try again.");
    } finally {
      setLoadingLanguages(false);
    }
  }, [languages.length, loadingLanguages]);

  const translatePage = useCallback(async (language: string) => {
    const currentRun = ++runId.current;
    activeLanguage.current = language;
    document.documentElement.lang = language;
    if (language === "en") {
      setLoadingTranslation(false);
      for (const [node, saved] of textMap.current) {
        if (node.isConnected && node.nodeValue === saved.translated) node.nodeValue = saved.source;
      }
      return;
    }

    setLoadingTranslation(true);
    setMessage("");
    try {
      const pending: { node: Text; source: string }[] = [];
      for (const node of eligibleTextNodes()) {
        const previous = textMap.current.get(node);
        const current = node.nodeValue ?? "";
        const source = previous && current === previous.translated ? previous.source : current;
        if (!source.trim() || current !== source && previous?.translated === current) continue;
        textMap.current.set(node, { source, translated: previous?.translated ?? "" });
        const key = `${language}\u0000${source}`;
        const cached = cache.current.get(key);
        if (cached !== undefined) {
          if (node.nodeValue !== cached) node.nodeValue = cached;
          textMap.current.set(node, { source, translated: cached });
        } else if (current !== source || current.trim()) {
          pending.push({ node, source });
        }
      }

      for (let index = 0; index < pending.length; index += 128) {
        const batch = pending.slice(index, index + 128);
        const response = await fetch(TRANSLATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: language, texts: batch.map((item) => item.source) }),
        });
        const data: unknown = await response.json();
        if (!response.ok || typeof data !== "object" || data === null || !("translations" in data) || !Array.isArray(data.translations))
          throw new Error(response.status === 503 ? "setup" : "translate");
        if (currentRun !== runId.current) return;
        batch.forEach(({ node, source }, batchIndex) => {
          const translated = data.translations[batchIndex];
          if (typeof translated !== "string" || !node.isConnected) return;
          cache.current.set(`${language}\u0000${source}`, translated);
          node.nodeValue = translated;
          textMap.current.set(node, { source, translated });
        });
      }
      if (currentRun === runId.current) {
        try {
          localStorage.setItem("sis-google-translate-language", language);
        } catch {
          // Translation remains available when browser storage is disabled.
        }
      }
    } catch (error) {
      if (currentRun === runId.current) {
        setMessage(error instanceof Error && error.message === "setup"
          ? "Translation needs a Google Cloud API key. Ask the site administrator to configure it."
          : "Translation failed. Check the Google Cloud API setup and try again.");
        activeLanguage.current = "en";
        document.documentElement.lang = "en";
        setSelected("en");
      }
    } finally {
      if (currentRun === runId.current) setLoadingTranslation(false);
    }
  }, []);

  useEffect(() => {
    const saved = readSavedLanguage();
    setSelected(saved);
    activeLanguage.current = saved;
    if (saved !== "en") void loadLanguages();
  }, [loadLanguages]);

  useEffect(() => {
    if (selected === "en") {
      void translatePage("en");
      return;
    }
    if (languages.length > 1) void translatePage(selected);
  }, [languages.length, pathname, selected, translatePage]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
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

  useEffect(() => {
    if (selected === "en") return;
    let timer = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void translatePage(activeLanguage.current); }, 350);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname, selected, translatePage]);

  function toggleMenu() {
    const next = !open;
    setOpen(next);
    if (next) void loadLanguages();
  }

  function chooseLanguage(code: string) {
    setOpen(false);
    setSelected(code);
    activeLanguage.current = code;
    if (code === "en") {
      try {
        localStorage.setItem("sis-google-translate-language", "en");
      } catch {
        // The language choice is still applied for this page view.
      }
    }
  }

  const current = languages.find((language) => language.code === selected)?.name ?? selected;
  return (
    <div className="relative" ref={menuRef}>
      <IconButton
        label={`Choose page language. Current language: ${current}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleMenu}
      >
        <Languages size={19} aria-hidden="true" />
      </IconButton>
      {open && (
        <div role="menu" aria-label="Choose page language" className="absolute right-0 top-[calc(100%+8px)] z-[80] max-h-[min(70vh,24rem)] w-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)] shadow-xl">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {loadingLanguages ? "Loading supported languages..." : loadingTranslation ? "Translating page..." : "Translate page"}
          </p>
          {languages.map((language) => (
            <button
              key={language.code}
              type="button"
              role="menuitemradio"
              aria-checked={selected === language.code}
              disabled={loadingLanguages || loadingTranslation}
              onClick={() => chooseLanguage(language.code)}
              className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)] ${selected === language.code ? "font-bold" : ""}`}
            >
              {language.name}
              {selected === language.code ? <span aria-hidden="true">&#10003;</span> : null}
            </button>
          ))}
          {message && <p role="status" className="px-3 py-2 text-xs text-[var(--danger)]">{message}</p>}
          <p className="border-t border-[var(--border)] px-3 py-2 text-[10px] leading-4 text-[var(--text-muted)]">
            Translations are provided by Google Cloud Translation.
          </p>
        </div>
      )}
      <div aria-live="polite" className="sr-only">{message}</div>
    </div>
  );
}
