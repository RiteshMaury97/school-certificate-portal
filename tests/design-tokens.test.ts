import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type Tokens = Record<string, string>;

function parseBlock(css: string, selector: string): Tokens {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  const tokens: Tokens = {};
  for (const match of css.slice(start, end).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)) {
    const name = match[1];
    const value = match[2];
    if (name && value) tokens[name] = value;
  }
  return tokens;
}
function requiredToken(tokens: Tokens, name: string): string {
  const token = tokens[name];
  if (!token) throw new Error(`Missing color token: ${name}`);
  return token;
}
function luminance(hex: string): number {
  const channel = (index: number) => {
    const c = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(1);
  const g = channel(3);
  const b = channel(5);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const luminances = [luminance(a), luminance(b)];
  const hi = Math.max(...luminances);
  const lo = Math.min(...luminances);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ["text", "bg"], ["text", "surface"], ["text", "surface-2"],
  ["text-muted", "bg"], ["text-muted", "surface"], ["text-muted", "surface-2"],
  ["on-primary", "primary"], ["on-primary", "primary-hover"],
  ["accent", "bg"], ["accent", "surface"],
  ["danger", "surface"], ["success", "surface"], ["warning", "surface"],
  ["danger", "bg"], ["success", "bg"], ["warning", "bg"],
];
const UI_PAIRS: [string, string][] = [
  ["border", "bg"], ["border", "surface"], ["focus", "bg"], ["focus", "surface"],
  ["primary", "bg"], ["primary", "surface"],
];

describe("design tokens", () => {
  it.each([
    ["light", ":root"],
    ["dark", ':root[data-theme="dark"]'],
  ])("%s theme meets WCAG AA", async (_name, selector) => {
    const css = await readFile("src/styles/globals.css", "utf8");
    const base = parseBlock(css, ":root");
    const tokens = selector === ":root" ? base : { ...base, ...parseBlock(css, selector) };
    for (const [fg, bg] of TEXT_PAIRS)
      expect(ratio(requiredToken(tokens, fg), requiredToken(tokens, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    for (const [fg, bg] of UI_PAIRS)
      expect(ratio(requiredToken(tokens, fg), requiredToken(tokens, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
  });

  it("has no high-contrast mode and no legacy palette left", async () => {
    const css = await readFile("src/styles/globals.css", "utf8");
    expect(css).not.toMatch(/contrast/i);
    for (const old of ["#e8e8e8", "#55f5b8", "#050707", "#c0c0c0", "#a0c0d0"])
      expect(css.toLowerCase()).not.toContain(old);
  });
});
