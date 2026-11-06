// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FaqPage from "@/features/faq/FaqView";
import ThemeProvider from "@/features/theme/ThemeProvider";
import { LocaleProvider } from "@/i18n/locale-provider";

import type { ReactNode } from "react";


vi.mock("next/navigation", () => ({
  usePathname: () => "/faq",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("public FAQ accessibility", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => ({ settings: { faqs: [{ questionEn: "Name not found", answerEn: "Check the spelling used in your school records." }] } }) }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("uses native keyboard-operable disclosure controls for FAQs", async () => {
    render(<ThemeProvider><LocaleProvider><FaqPage /></LocaleProvider></ThemeProvider>);
    expect(screen.getByRole("heading", { name: "Frequently asked questions" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Name not found")).toBeTruthy();
    });
    expect(document.querySelector("details > summary")?.textContent).toContain("Name not found");
  });
});
