import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const publicRoutes = [
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
];
const adminRoutes = [
  "/admin/login",
  "/admin/mfa",
  "/admin",
  "/admin/students",
  "/admin/certificates",
  "/admin/certificates/upload",
  "/admin/approvals",
  "/admin/sessions",
  "/admin/tickets",
  "/admin/audit",
  "/admin/settings",
  "/admin/admins",
  "/admin/backup",
];

describe("school services route architecture", () => {
  it("registers every public route", async () => {
    const routes = await readFile("src/app/routes.tsx", "utf8");
    for (const route of publicRoutes) expect(routes).toContain(`path="${route}"`);
  });
  it("registers every protected administration route", async () => {
    const routes = await readFile("src/app/routes.tsx", "utf8");
    for (const route of adminRoutes) expect(routes).toContain(`path="${route}"`);
    expect(routes).toContain("<Protected>");
  });
  it("lazy-loads every page and wraps the route tree in Suspense", async () => {
    const routes = await readFile("src/app/routes.tsx", "utf8");
    const router = await readFile("src/app/AppRouter.tsx", "utf8");
    expect(routes).toContain("lazy(() => import(");
    expect(router).toContain("<Suspense fallback={<Skeleton />}>");
  });
});
