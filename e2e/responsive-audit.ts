import type { Page, Route } from "@playwright/test";

import {
  certificatesFor,
  siteSettingsFor,
  studentsFor,
  type ResponsiveScenario,
} from "./fixtures/responsive-data";

export const responsiveRoutes = [
  "/", "/certificates", "/certificates/results", "/certificates/print", "/verify",
  "/faq", "/contact", "/report-wrong-record", "/data-rights", "/terms", "/privacy",
  "/offline", "/maintenance", "/this-page-does-not-exist", "/admin/login", "/admin",
  "/admin/students", "/admin/students/add", "/admin/students/import", "/admin/certificates",
  "/admin/certificates/upload", "/admin/approvals", "/admin/sessions", "/admin/audit",
  "/admin/timeline", "/admin/tickets", "/admin/contacts", "/admin/breaches",
  "/admin/settings", "/admin/announcements", "/admin/faqs", "/admin/admins",
  "/admin/profile", "/admin/account-sessions",
] as const;

export const viewports = [
  [320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932],
  [667, 375], [844, 390], [768, 1024], [820, 1180], [1024, 768], [1280, 800],
  [1440, 900], [1920, 1080], [2560, 1440],
] as const;

export const themes = ["light", "dark", "contrast"] as const;
export type Theme = (typeof themes)[number];
export type AuditRow = {
  route: string;
  viewport: string;
  theme: Theme;
  fixture: string;
  checks: Record<string, boolean | null>;
  failures: string[];
};

function scenarioForRoute(path: string): ResponsiveScenario {
  if (path === "/admin/students" || path === "/admin/students/import") return "worst";
  if (path.includes("certificates")) return "worst";
  if (path === "/admin/approvals") return "normal";
  if (path === "/admin/audit" || path === "/admin/timeline") return "empty";
  return "normal";
}

function apiResponse(path: string, scenario: ResponsiveScenario): Record<string, unknown> {
  const students = studentsFor(scenario);
  const certificates = certificatesFor(scenario);
  const catalog = { items: scenario === "empty" ? [] : [{ id: "2025-26", label: "2025-26" }] };
  if (path.endsWith("/admin/session"))
    return { authenticated: true, uid: "responsive-audit-admin", email: "responsive.audit@example.test", role: "superadmin", hardExpiresAt: Date.now() + 3_600_000 };
  if (path.endsWith("/public/site-settings")) return { settings: siteSettingsFor(scenario) };
  if (path.endsWith("/public/sessions")) return { sessions: scenario === "empty" ? [] : ["2025-26"] };
  if (path.endsWith("/public/classes")) return { classes: scenario === "empty" ? [] : ["Class 10"] };
  if (path.endsWith("/certificates/search"))
    return {
      found: true,
      studentName: scenario === "worst" ? "Aarav VeryLongStudentName".repeat(3) : "Rahul Kumar",
      className: "Class 10",
      session: "2025-26",
      accessToken: "responsive-audit-access-token",
      tokenExpiresIn: 600,
      certificates: certificates.map((certificate) => ({
        certId: certificate.id,
        title: certificate.type,
        type: certificate.type,
        session: certificate.session,
        issueDate: certificate.issueDate,
        certificateNumber: certificate.certificateNumber,
        mimeType: "application/pdf",
      })),
    };
  if (path.endsWith("/admin/students/list")) return { students };
  if (path.endsWith("/admin/students")) return { students };
  if (path.endsWith("/admin/certificates")) return { certificates };
  if (path.endsWith("/admin/dashboard")) return { stats: { students: students.length, certificates: certificates.length, pending: certificates.length } };
  if (path.includes("/admin/catalog/")) return catalog;
  if (path.endsWith("/admin/audit")) return { logs: [] };
  if (path.endsWith("/admin/timeline")) return { events: [] };
  if (path.endsWith("/admin/rights")) return { requests: [] };
  if (path.endsWith("/admin/breaches")) return { breaches: [] };
  if (path.endsWith("/admin/breaches/summary")) return { summary: {} };
  if (path.endsWith("/admin/reports")) return { reports: [] };
  if (path.endsWith("/admin/contact-enquiries")) return { enquiries: [] };
  if (path.endsWith("/admin/faqs")) return { faqs: siteSettingsFor(scenario).faqs };
  if (path.endsWith("/admin/users")) return { admins: [] };
  if (path.endsWith("/admin/site-settings")) return { settings: siteSettingsFor(scenario), recentLocationBlocks: [] };
  if (path.endsWith("/admin/profile")) return { profile: {}, account: {} };
  if (path.endsWith("/admin/sessions")) return { sessions: [], recentLogins: [] };
  if (path.endsWith("/public/search")) return { certificates };
  return { ok: true, items: [], certificates: [], students: [], reports: [], requests: [], breaches: [], enquiries: [], events: [], logs: [] };
}

async function routeApi(route: Route, scenario: ResponsiveScenario) {
  const requestUrl = new URL(route.request().url());
  const body = apiResponse(requestUrl.pathname, scenario);
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

export async function mockResponsiveApis(page: Page, scenario: ResponsiveScenario) {
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/api/**", (route) => routeApi(route, scenario));
  await page.route("**/firebaseappcheck.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "e2e-app-check-token", ttl: "3600s" }) }),
  );
  await page.route("**/identitytoolkit.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ idToken: "e2e-token" }) }),
  );
  await page.route("**/securetoken.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "e2e-token" }) }),
  );
  await page.route("**/firebasestorage.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, body: "" }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        render: (_element: HTMLElement, options: { callback?: (token: string) => void }) => {
          options.callback?.("responsive-audit-turnstile-token");
          return "responsive-audit";
        },
        reset: () => undefined,
        remove: () => undefined,
      },
    });
  });
}

export function scenarioFor(path: string): ResponsiveScenario {
  return scenarioForRoute(path);
}
