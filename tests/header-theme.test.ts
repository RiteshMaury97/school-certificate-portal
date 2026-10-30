import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("school site header and theme", () => {
  it("provides responsive nav and icon-only utility controls", async () => {
    const header = await readFile("src/components/layout/Header.tsx", "utf8");
    for (const label of ["Home", "Certificates", "Verify", "FAQ", "Contact"])
      expect(header).toContain(label);
    for (const icon of ["Menu", "ShieldCheck"]) expect(header).toContain(icon);
    expect(header).toContain("min-h-11");
    expect(header).toContain("aria-expanded");
    expect(header).toContain("aria-label");
    expect(header).toContain("NavLink");
    expect(header).toContain("Satyam Intl. School");
  });
  it("cycles system, light and dark themes and persists the selection safely", async () => {
    const theme = await readFile("src/features/theme/ThemeProvider.tsx", "utf8");
    for (const mode of ['"system"', '"light"', '"dark"']) expect(theme).toContain(mode);
    expect(theme).toContain("localStorage.setItem");
    expect(theme).toContain("data-theme");
    expect(theme).toContain("data-contrast");
  });
  it("sets theme before first paint and declares all required token sets", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");
    const css = await readFile("src/styles/globals.css", "utf8");
    expect(layout).toContain("themeInit");
    expect(layout).toContain("dangerouslySetInnerHTML");
    for (const token of [
      "--bg",
      "--surface",
      "--surface-2",
      "--text",
      "--text-muted",
      "--border",
      "--primary",
      "--primary-contrast",
      "--accent",
      "--danger",
      "--success",
      "--warning",
      "--focus",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain(':root[data-contrast="high"]');
  });
  it("only displays footer details when present", async () => {
    const footer = await readFile("src/components/layout/Footer.tsx", "utf8");
    expect(footer).toContain("{lastUpdated &&");
    expect(footer).toContain("{address &&");
    expect(footer).toContain("{email &&");
    expect(footer).toContain("{phone &&");
  });
});
