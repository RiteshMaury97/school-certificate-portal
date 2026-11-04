import {
  certificatesFor,
  siteSettingsFor,
  studentsFor,
  type ResponsiveScenario,
} from "./fixtures/responsive-data";

import type { Page, Route } from "@playwright/test";

export const responsiveRoutes = [
  "/",
  "/certificates",
  "/certificates/results",
  "/certificates/print",
  "/verify",
  "/faq",
  "/contact",
  "/report-wrong-record",
  "/data-rights",
  "/terms",
  "/privacy",
  "/offline",
  "/maintenance",
  "/this-page-does-not-exist",
  "/admin/login",
  "/admin",
  "/admin/students",
  "/admin/students/add",
  "/admin/students/import",
  "/admin/certificates",
  "/admin/certificates/upload",
  "/admin/approvals",
  "/admin/sessions",
  "/admin/audit",
  "/admin/timeline",
  "/admin/tickets",
  "/admin/contacts",
  "/admin/breaches",
  "/admin/settings",
  "/admin/announcements",
  "/admin/faqs",
  "/admin/admins",
  "/admin/profile",
  "/admin/account-sessions",
] as const;

export const viewports = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [412, 915],
  [430, 932],
  [667, 375],
  [844, 390],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
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

type ApiResponseBuilder = (
  scenario: ResponsiveScenario,
  students: ReturnType<typeof studentsFor>,
  certificates: ReturnType<typeof certificatesFor>,
) => Record<string, unknown>;

const apiResponseHandlers: [(path: string) => boolean, ApiResponseBuilder][] = [
  [
    (path) => path.endsWith("/admin/session"),
    () => ({
      authenticated: true,
      uid: "responsive-audit-admin",
      email: "responsive.audit@example.test",
      role: "superadmin",
      hardExpiresAt: Date.now() + 3_600_000,
    }),
  ],
  [
    (path) => path.endsWith("/public/site-settings"),
    (scenario) => ({ settings: siteSettingsFor(scenario) }),
  ],
  [
    (path) => path.endsWith("/public/sessions"),
    (scenario) => ({
      sessions: scenario === "empty" ? [] : ["2025-26"],
    }),
  ],
  [
    (path) => path.endsWith("/public/classes"),
    (scenario) => ({
      classes: scenario === "empty" ? [] : ["Class 10"],
    }),
  ],
  [
    (path) => path.endsWith("/certificates/search"),
    (scenario, _students, certificates) => ({
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
    }),
  ],
  [
    (path) => path.endsWith("/admin/students/list") || path.endsWith("/admin/students"),
    (_scenario, students) => ({ students }),
  ],
  [
    (path) => path.endsWith("/admin/certificates"),
    (_scenario, _students, certificates) => ({ certificates }),
  ],
  [
    (path) => path.endsWith("/admin/dashboard"),
    (_scenario, students, certificates) => ({
      stats: {
        students: students.length,
        certificates: certificates.length,
        pending: certificates.length,
      },
    }),
  ],
  [
    (path) => path.includes("/admin/catalog/"),
    (scenario) => ({
      items: scenario === "empty" ? [] : [{ id: "2025-26", label: "2025-26" }],
    }),
  ],
  [(path) => path.endsWith("/admin/audit"), () => ({ logs: [] })],
  [(path) => path.endsWith("/admin/timeline"), () => ({ events: [] })],
  [(path) => path.endsWith("/admin/rights"), () => ({ requests: [] })],
  [(path) => path.endsWith("/admin/breaches"), () => ({ breaches: [] })],
  [(path) => path.endsWith("/admin/breaches/summary"), () => ({ summary: {} })],
  [(path) => path.endsWith("/admin/reports"), () => ({ reports: [] })],
  [(path) => path.endsWith("/admin/contact-enquiries"), () => ({ enquiries: [] })],
  [
    (path) => path.endsWith("/admin/faqs"),
    (scenario) => ({ faqs: siteSettingsFor(scenario).faqs }),
  ],
  [(path) => path.endsWith("/admin/users"), () => ({ admins: [] })],
  [
    (path) => path.endsWith("/admin/site-settings"),
    (scenario) => ({
      settings: siteSettingsFor(scenario),
      recentLocationBlocks: [],
    }),
  ],
  [(path) => path.endsWith("/admin/profile"), () => ({ profile: {}, account: {} })],
  [(path) => path.endsWith("/admin/sessions"), () => ({ sessions: [], recentLogins: [] })],
  [
    (path) => path.endsWith("/public/search"),
    (_scenario, _students, certificates) => ({ certificates }),
  ],
];

function apiResponse(path: string, scenario: ResponsiveScenario): Record<string, unknown> {
  const students = studentsFor(scenario);
  const certificates = certificatesFor(scenario);
  const handler = apiResponseHandlers.find(([matches]) => matches(path));
  if (handler) return handler[1](scenario, students, certificates);
  return {
    ok: true,
    items: [],
    certificates: [],
    students: [],
    reports: [],
    requests: [],
    breaches: [],
    enquiries: [],
    events: [],
    logs: [],
  };
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
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: "e2e-app-check-token", ttl: "3600s" }),
    }),
  );
  await page.route("**/identitytoolkit.googleapis.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ idToken: "e2e-token" }),
    }),
  );
  await page.route("**/securetoken.googleapis.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "e2e-token" }),
    }),
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
        reset: () => {
          // The test mock has no external widget state to reset.
        },
        remove: () => {
          // The test mock does not create a DOM widget to remove.
        },
      },
    });
  });
}

export function scenarioFor(path: string): ResponsiveScenario {
  return scenarioForRoute(path);
}
