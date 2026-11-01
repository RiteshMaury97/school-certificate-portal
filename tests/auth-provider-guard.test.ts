import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";
const forbidden = [/totp/i, /TotpMultiFactorGenerator/, /multiFactor/i, /getMultiFactorResolver/, /MultiFactorResolver/, /sign_in_second_factor/i, /otpauth/i, /authenticator/i, /enroll/i, /\bMFA\b/i];
async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [full] : [];
  }));
  return nested.flat();
}
describe("authentication source policy", () => {
  it("does not reintroduce removed Firebase factors in application source", async () => {
    const files = [...await sourceFiles(path.join(process.cwd(), "src")), ...await sourceFiles(path.join(process.cwd(), "app")).catch(() => [])];
    const matches: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (forbidden.some((pattern) => pattern.test(content))) matches.push(path.relative(process.cwd(), file));
    }
    expect(matches).toEqual([]);
  });
});
