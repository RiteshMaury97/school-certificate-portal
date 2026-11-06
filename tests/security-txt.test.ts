import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("security.txt route", () => {
  it("publishes the RFC contact, expiry, canonical URL and policy fields", async () => {
    const source = await readFile("src/app/.well-known/security.txt/route.ts", "utf8");
    for (const field of ["Contact:", "Expires:", "Canonical:", "Policy:"]) {
      expect(source).toContain(field);
    }
    expect(source).toContain("SECURITY_CONTACT_EMAIL");
    expect(source).toContain('"text/plain; charset=utf-8"');
  });
});
