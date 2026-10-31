// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FaqPage from "@/features/faq/FaqView";

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
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ settings: {} }) }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("uses native keyboard-operable disclosure controls for FAQs", () => {
    render(<FaqPage />);
    expect(screen.getByRole("heading", { name: "Frequently Asked Questions" })).toBeTruthy();
    expect(screen.getAllByText("Name not found").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("details > summary").length).toBeGreaterThan(0);
  });
});
