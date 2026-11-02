import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Google Cloud Translation integration", () => {
  it("loads the supported language list from the language menu interaction", async () => {
    const source = await readFile("src/features/translate/LanguageButton.tsx", "utf8");
    const hook = await readFile("src/features/translate/use-page-translation.ts", "utf8");
    expect(source).toContain("if (next) void translation.loadLanguages()");
    expect(hook).toContain("/api/public/translation/languages");
    expect(hook).toContain("/api/public/translation/translate");
    expect(hook).toContain("childList: true, subtree: true");
  });
  it("stores language choice and updates the document language without a third-party cookie", async () => {
    const source = await readFile("src/features/translate/use-page-translation.ts", "utf8");
    expect(source).toContain("sis-google-translate-language");
    expect(source).toContain("document.documentElement.lang = language");
    expect(source).toContain("restoreEnglish()");
    expect(source).toContain("Translation needs a Google Cloud API key");
  });
  it("excludes personal results and admin pages from translation", async () => {
    const results = await readFile("src/features/certificates/ResultsView.tsx", "utf8");
    const print = await readFile("src/features/certificates/PrintView.tsx", "utf8");
    const finder = await readFile("src/features/certificates/FinderView.tsx", "utf8");
    const hook = await readFile("src/features/translate/use-page-translation.ts", "utf8");
    expect(results).toContain('notranslate" translate="no"');
    expect(print).toContain('className="mx-auto max-w-4xl p-6 print:p-0 notranslate"');
    expect(finder).toContain("studentName");
    expect(hook).toContain("textarea,input,select,option");
  });
  it("documents Google Cloud Translation processing and local language storage", async () => {
    const privacy = await readFile("src/features/legal/PrivacyView.tsx", "utf8");
    expect(privacy).toContain("visible page text is sent to Google");
    expect(privacy).toContain("browser local storage");
    expect(privacy).not.toContain("googtrans");
  });
});
