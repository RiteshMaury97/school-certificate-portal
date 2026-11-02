"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Language = { code: string; name: string };
type SavedText = { source: string; translated: string };
const ENGLISH: Language = { code: "en", name: "English" };
const LANGUAGES_URL = "/api/public/translation/languages";
const TRANSLATE_URL = "/api/public/translation/translate";
const LANGUAGE_EVENT = "sis-page-language-change";

function subscribeLanguage(callback: () => void) {
  window.addEventListener(LANGUAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function currentLanguage(): string {
  try {
    return localStorage.getItem("sis-google-translate-language") ?? "en";
  } catch {
    return "en";
  }
}

function setLanguagePreference(language: string) {
  try {
    localStorage.setItem("sis-google-translate-language", language);
  } catch {
    // The current page can still use the selected language.
  }
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLanguages(value: unknown): Language[] {
  if (!isRecord(value) || !Array.isArray(value.languages)) return [];
  const result: Language[] = [];
  for (const item of value.languages) {
    if (isRecord(item) && typeof item.code === "string" && typeof item.name === "string")
      result.push({ code: item.code, name: item.name });
  }
  return result;
}

function textNodes(): Text[] {
  const skipped = "script,style,noscript,svg,textarea,input,select,option,[translate='no'],.notranslate,[aria-hidden='true'],[data-translate-ignore]";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const result: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType !== Node.TEXT_NODE || !(node instanceof Text)) continue;
    const parent = node.parentElement;
    if (parent?.closest(skipped) || parent?.isContentEditable || !(node.nodeValue ?? "").trim()) continue;
    result.push(node);
  }
  return result;
}

function sourceText(node: Text, saved: Map<Text, SavedText>): string {
  const previous = saved.get(node);
  const current = node.nodeValue ?? "";
  return previous && current === previous.translated ? previous.source : current;
}

function restoreOriginalText(saved: Map<Text, SavedText>) {
  for (const [node, value] of saved) {
    if (node.isConnected && node.nodeValue === value.translated) node.nodeValue = value.source;
  }
}

async function requestBatch(language: string, texts: string[]): Promise<string[]> {
  const response = await fetch(TRANSLATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: language, texts }),
  });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(response.status === 503 ? "setup" : "translate");
  if (!isRecord(data) || !Array.isArray(data.translations) ||
      !data.translations.every((item) => typeof item === "string"))
    throw new Error("translate");
  if (data.translations.length !== texts.length) throw new Error("translate");
  return data.translations;
}

type TranslationItem = { node: Text; source: string };

function prepareTranslation(
  language: string,
  cache: Map<string, string>,
  savedTexts: Map<Text, SavedText>,
): TranslationItem[] {
  const pending: TranslationItem[] = [];
  for (const node of textNodes()) {
    const source = sourceText(node, savedTexts);
    if (!source.trim()) continue;
    const translated = cache.get(`${language}\u0000${source}`);
    savedTexts.set(node, { source, translated: translated ?? "" });
    if (translated === undefined) pending.push({ node, source });
    else if (node.nodeValue !== translated) node.nodeValue = translated;
  }
  return pending;
}

type PendingTranslation = {
  pending: TranslationItem[];
  language: string;
  request: number;
  requestId: { current: number };
  cache: Map<string, string>;
  savedTexts: Map<Text, SavedText>;
};

export function usePageTranslation(pathname: string) {
  const selected = useSyncExternalStore(subscribeLanguage, currentLanguage, () => "en");
  const [languages, setLanguages] = useState<Language[]>([ENGLISH]);
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [message, setMessage] = useState("");
  const savedTexts = useRef(new Map<Text, SavedText>());
  const cache = useRef(new Map<string, string>());
  const activeLanguage = useRef("en");
  const requestId = useRef(0);

  const restoreEnglish = useCallback(() => {
    activeLanguage.current = "en";
    document.documentElement.lang = "en";
    restoreOriginalText(savedTexts.current);
  }, []);

  const loadLanguages = useCallback(async () => {
    if (languages.length > 1 || loadingLanguages) return;
    setLoadingLanguages(true);
    setMessage("");
    try {
      const response = await fetch(LANGUAGES_URL, { cache: "force-cache" });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(response.status === 503 ? "setup" : "languages");
      const supported = readLanguages(data);
      if (!supported.length) throw new Error("languages");
      setLanguages([ENGLISH, ...supported.filter((language) => language.code !== "en")]);
    } catch (error) {
      setMessage(error instanceof Error && error.message === "setup"
        ? "Translation needs a Google Cloud API key. Ask the site administrator to configure it."
        : "Could not load Google's supported languages. Try again.");
    } finally {
      setLoadingLanguages(false);
    }
  }, [languages.length, loadingLanguages]);

  const translatePage = useCallback(async (language: string) => {
    const currentRequest = ++requestId.current;
    activeLanguage.current = language;
    document.documentElement.lang = language;
    if (language === "en") {
      setLoadingTranslation(false);
      restoreEnglish();
      return;
    }
    setLoadingTranslation(true);
    setMessage("");
    try {
      const pending = prepareTranslation(language, cache.current, savedTexts.current);
      await translatePending({
        pending,
        language,
        request: currentRequest,
        requestId,
        cache: cache.current,
        savedTexts: savedTexts.current,
      });
      if (currentRequest === requestId.current) setLanguagePreference(language);
    } catch (error) {
      if (currentRequest === requestId.current) {
        setMessage(error instanceof Error && error.message === "setup"
          ? "Translation needs a Google Cloud API key. Ask the site administrator to configure it."
          : "Translation failed. Check the Google Cloud API setup and try again.");
        restoreEnglish();
        setLanguagePreference("en");
      }
    } finally {
      if (currentRequest === requestId.current) setLoadingTranslation(false);
    }
  }, [restoreEnglish]);

  useEffect(() => {
    if (selected === "en") return;
    const timer = window.setTimeout(() => { void loadLanguages(); }, 0);
    return () => { window.clearTimeout(timer); };
  }, [loadLanguages, selected]);

  useEffect(() => {
    if (selected === "en" || languages.length < 2) return;
    const timer = window.setTimeout(() => { void translatePage(selected); }, 0);
    return () => { window.clearTimeout(timer); };
  }, [languages.length, pathname, selected, translatePage]);

  useEffect(() => {
    if (selected === "en") return;
    let timer = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void translatePage(activeLanguage.current); }, 350);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname, selected, translatePage]);

  const chooseLanguage = useCallback((code: string) => {
    setMessage("");
    if (code === "en") {
      ++requestId.current;
      restoreEnglish();
      setLoadingTranslation(false);
      setLanguagePreference("en");
      return;
    }
    activeLanguage.current = code;
    setLanguagePreference(code);
  }, [restoreEnglish]);

  return { languages, selected, loadingLanguages, loadingTranslation, message, chooseLanguage, loadLanguages };
}

async function translatePending(
  { pending, language, request, requestId, cache, savedTexts }: PendingTranslation,
) {
  for (let index = 0; index < pending.length; index += 128) {
    if (request !== requestId.current) return;
    const batch = pending.slice(index, index + 128);
    const translated = await requestBatch(language, batch.map((item) => item.source));
    if (request !== requestId.current) return;
    for (const [batchIndex, item] of batch.entries()) {
      const value = translated[batchIndex];
      if (value === undefined || !item.node.isConnected) continue;
      cache.set(`${language}\u0000${item.source}`, value);
      item.node.nodeValue = value;
      savedTexts.set(item.node, { source: item.source, translated: value });
    }
  }
}
