// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FaqPage from "@/features/faq/FaqView";
import ThemeProvider from "@/features/theme/ThemeProvider";

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
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          settings: {
            faqs: [{ questionEn: "Name not found", answerEn: "Check the passing session." }],
          },
        }),
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("uses native keyboard-operable disclosure controls for FAQs", async () => {
    render(
      <ThemeProvider>
        <FaqPage />
      </ThemeProvider>,
    );
    expect(screen.getByRole("heading", { name: "Frequently asked questions" })).toBeTruthy();
    await vi.waitFor(() => {
      expect(document.querySelectorAll("details > summary").length).toBeGreaterThan(0);
    });
  });
});
