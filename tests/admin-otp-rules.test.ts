import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("admin OTP Firestore access policy", () => {
  it("explicitly denies all client access to challenge records", async () => {
    const rules = await readFile(resolve(process.cwd(), "firebase/firestore.rules"), "utf8");
    expect(rules).toMatch(/match \/adminOtpChallenges\/\{challengeId\}/);
    expect(rules).toMatch(/match \/adminOtpChallenges\/\{challengeId\}\s*\{\s*allow read, write: if false;/);
  });
});
