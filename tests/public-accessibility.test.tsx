// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FaqPage from "@/src/screens/FaqPage";

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
    render(
      <BrowserRouter>
        <FaqPage />
      </BrowserRouter>,
    );
    expect(screen.getByRole("heading", { name: "Frequently Asked Questions" })).toBeTruthy();
    expect(screen.getAllByText("Name not found").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("details > summary").length).toBeGreaterThan(0);
  });
});
