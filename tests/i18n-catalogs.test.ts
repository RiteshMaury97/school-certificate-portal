import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const locales = ["hi", "bn", "mr", "gu", "pa", "ta", "te", "ur"];
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseRecord(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed)) throw new Error("Expected a JSON object.");
  return parsed;
}
const placeholders = (value: unknown): string[] =>
  typeof value === "string"
    ? [...value.matchAll(/\{[A-Za-z_][A-Za-z0-9_.-]*\}|https?:\/\/[^\s<>]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b(?=[A-Z0-9/-]{6,}\b)(?=[A-Z0-9/-]*[0-9])[A-Z0-9/-]+\b/g)].map(([match]) => match)
    : typeof value === "object" && value !== null
      ? Object.values(value).flatMap(placeholders)
      : [];

describe("static locale catalogs", () => {
  it("has the same keys and placeholders as English", async () => {
    const english = parseRecord(await readFile("src/i18n/messages/en.json", "utf8"));
    const keys = (value: unknown): unknown => {
      if (typeof value !== "object" || value === null) return typeof value;
      if (Array.isArray(value)) return value.map(keys);
      return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "_meta").map(([key, child]) => [key, keys(child)]));
    };
    for (const locale of locales) {
      const catalog = parseRecord(await readFile(`src/i18n/messages/${locale}.json`, "utf8"));
      expect(keys(catalog), `${locale} keys`).toEqual(keys(english));
      expect(placeholders(catalog).sort(), `${locale} placeholders`).toEqual(placeholders(english).sort());
    }
  });
});
