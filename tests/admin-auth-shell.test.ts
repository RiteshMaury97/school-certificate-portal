import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("administrator authentication and shell contracts", () => {
  it("offers email, password visibility, password reset, Google sign-in and mandatory TOTP", async () => {
    const source = await readFile("src/screens/LoginPage.tsx", "utf8");
    for (const value of [
      "signInWithEmailAndPassword",
      "GoogleAuthProvider",
      "signInWithPopup",
      "signInWithRedirect",
      "sendPasswordResetEmail",
      "TotpMultiFactorGenerator",
      "Forgot password?",
      "Sign in with Google",
      "Show password",
    ]) {
      expect(source).toContain(value);
    }
  });
  it("requires active approved admins and verified email before preflight", async () => {
    const source = await readFile("app/api/admin/preflight/route.ts", "utf8");
    expect(source).toContain("decoded.email_verified");
    expect(source).toContain('admin.get("status") !== "active"');
    expect(source).toContain("This account is not authorized.");
  });
  it("only establishes sessions after a verified Firebase second factor", async () => {
    const source = await readFile("app/api/admin/session/route.ts", "utf8");
    expect(source).toContain('["totp", "email"].includes(secondFactor ?? "")');
    expect(source).toContain('admin.get("status") !== "active"');
    expect(source).toContain("createSessionCookie");
  });
  it("redirects protected admin page requests without the session cookie", async () => {
    const source = await readFile("middleware.ts", "utf8");
    expect(source).toContain('request.cookies.get("sis_admin_session")');
    expect(source).toContain('login.pathname = "/admin/login"');
  });
  it("provides role-filtered navigation and mobile drawer controls", async () => {
    const source = await readFile("src/screens/AdminPage.tsx", "utf8");
    expect(source).toContain("Mobile admin navigation");
    expect(source).toContain("tabIcons");
    expect(source).toContain("Sign out of all devices");
    expect(source).toContain("Notifications and support tickets");
  });
});
