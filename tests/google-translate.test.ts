import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("lazy Google Translate integration", () => {
  it("loads the Google script only from the language menu interaction", async () => {
    const source = await readFile("src/features/translate/LanguageButton.tsx", "utf8");
    expect(source).toContain("function toggleMenu()");
    expect(source).toContain("if (next) loadWidget()");
    expect(source).toContain(
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit",
    );
    expect(source).toContain('pageLanguage: "en"');
    expect(source).toContain("api.TranslateElement.InlineLayout.SIMPLE");
    expect(source).toContain("id={widgetId}");
  });
  it("stores language choice, updates document language and manages the functional cookie", async () => {
    const source = await readFile("src/features/translate/LanguageButton.tsx", "utf8");
    expect(source).toContain("sis-google-translate-language");
    expect(source).toContain("document.documentElement.lang = code");
    expect(source).toContain("googtrans=/en/");
    expect(source).toContain("expires=");
    expect(source).toContain("Translation is unavailable right now");
  });
  it("excludes personal results and admin pages from translation", async () => {
    const results = await readFile("src/features/certificates/ResultsView.tsx", "utf8");
    const print = await readFile("src/features/certificates/PrintView.tsx", "utf8");
    const finder = await readFile("src/features/certificates/FinderView.tsx", "utf8");
    const routes = await readFile("src/app/routes.tsx", "utf8");
    expect(results).toContain('className="mx-auto max-w-5xl notranslate"');
    expect(print).toContain('className="mx-auto max-w-4xl p-6 print:p-0 notranslate"');
    expect(finder).toContain('className="notranslate mt-8"');
    expect(routes).toContain('className="notranslate" translate="no"');
  });
  it("documents Google translation processing and the googtrans functional cookie", async () => {
    const privacy = await readFile("src/features/legal/PrivacyView.tsx", "utf8");
    const footer = await readFile("src/components/layout/Footer.tsx", "utf8");
    expect(privacy).toContain("page text may be sent to Google");
    expect(privacy).toContain("googtrans");
    expect(footer).toContain("translationCookieUsed");
  });
});
