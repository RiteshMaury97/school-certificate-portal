import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readAll(...paths: string[]): Promise<string> {
  return (await Promise.all(paths.map((path) => readFile(path, "utf8")))).join("\n");
}

describe("administrator authentication and shell contracts", () => {
  it("offers email, password visibility, password reset, Google sign-in and mandatory TOTP", async () => {
    const source = await readAll(
      "src/features/auth/AdminAuthView.tsx",
      "src/features/auth/CredentialsStep.tsx",
      "src/features/auth/CodeSteps.tsx",
      "src/features/auth/useAdminSignIn.ts",
    );
    for (const value of [
      "signInWithEmailAndPassword",
      "GoogleAuthProvider",
      "signInWithPopup",
      "signInWithRedirect",
      "getRedirectResult",
      "sendPasswordResetEmail",
      "sendEmailVerification",
      "TotpMultiFactorGenerator",
      "Forgot password?",
      "Continue with Google",
      "Show password",
    ]) {
      expect(source).toContain(value);
    }
  });

  it("lets an MFA-enrolled account finish a Google redirect sign-in", async () => {
    const source = await readFile("src/features/auth/useAdminSignIn.ts", "utf8");
    // Regression: the redirect result handler used to treat the MFA challenge as a failure.
    expect(source).toMatch(/getRedirectResult[\s\S]*handleFirebaseError/);
    expect(source).toContain("isMfaRequired(cause)");
  });

  it("guards admin pages with the SERVER session, not Firebase client state", async () => {
    // Regression: the guard used onAuthStateChanged, but the login flow signs the
    // Firebase client out once the server cookie exists, so every login bounced back.
    const session = await readFile("src/features/auth/admin-session.tsx", "utf8");
    const gate = await readFile("src/features/auth/AdminGate.tsx", "utf8");
    expect(session).toContain("/api/admin/session");
    expect(session).not.toContain("onAuthStateChanged");
    expect(gate).toContain("useAdminSession");
    expect(gate).toContain("PageLoader");
  });

  it("requires approved admins and verified email before preflight", async () => {
    const source = await readFile("src/app/api/admin/preflight/route.ts", "utf8");
    expect(source).toContain("decoded.email_verified");
    expect(source).toContain('["active", "invited"]');
    expect(source).toContain("This account is not authorized.");
  });

  it("only establishes sessions after a verified Firebase TOTP second factor", async () => {
    const source = await readFile("src/app/api/admin/session/route.ts", "utf8");
    expect(source).toContain('secondFactor !== "totp"');
    expect(source).not.toContain('"email"].includes(secondFactor');
    expect(source).toContain("createSessionCookie");
    expect(source).toContain('status: "active"');
  });

  it("rejects disabled or invited admins on every protected API call", async () => {
    const source = await readFile("src/server/security.ts", "utf8");
    expect(source).toContain('admin.get("status") !== "active"');
  });

  it("redirects protected admin page requests without the session cookie", async () => {
    const source = await readFile("src/middleware.ts", "utf8");
    expect(source).toContain('request.cookies.get("sis_admin_session")');
    expect(source).toContain('login.pathname = "/admin/login"');
  });

  it("provides role-filtered navigation and mobile drawer controls", async () => {
    const source = await readFile("src/features/admin/AdminConsole.tsx", "utf8");
    expect(source).toContain("Mobile admin navigation");
    expect(source).toContain("tabIcons");
    expect(source).toContain("Sign out of all devices");
    expect(source).toContain("Notifications and support tickets");
  });
});
