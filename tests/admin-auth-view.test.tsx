// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

const settingsState = vi.hoisted(() => ({ schoolName: "" }));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/use-site-settings", () => ({
  usePublicSiteSettings: () => ({ schoolName: settingsState.schoolName }),
}));

vi.mock("@/features/auth/useAdminSignIn", () => ({
  useAdminSignIn: () => ({
    step: "credentials",
    email: "",
    busy: false,
    resetBusy: false,
    error: "",
    notice: "",
    pendingEmail: "",
    submitCredentials: vi.fn(),
    signInWithGoogle: vi.fn(),
    verifyCode: vi.fn(),
    cancel: vi.fn(),
    requestPasswordReset: vi.fn(),
  }),
}));

import AdminAuthView from "@/features/auth/AdminAuthView";

afterEach(() => {
  cleanup();
});

describe("AdminAuthView school heading fallback", () => {
  it.each(["", undefined])("shows the default school name when schoolName is %s", (schoolName) => {
    Reflect.set(settingsState, "schoolName", schoolName);
    render(<AdminAuthView />);
    expect(
      screen.getByRole("heading", {
        name: "Satyam International School – Administrator login",
      }),
    ).toBeTruthy();
  });
});
