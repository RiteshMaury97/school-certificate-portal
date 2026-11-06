import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("public site settings parsing", () => {
  it("validates Firestore values before publishing them to the client", async () => {
    const source = await readFile("src/lib/use-site-settings.ts", "utf8");
    expect(source).toContain("function isRecord(value: unknown)");
    expect(source).toContain("function parseStringSettings");
    expect(source).toContain("function parseSocialLinks");
    expect(source).toContain("function parseFaqs");
    expect(source).toContain("Ignoring invalid");
    expect(source).toContain('fetch("/api/public/site-settings"');
  });
});
