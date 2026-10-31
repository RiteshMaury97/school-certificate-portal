import { expect, test, type Page } from "@playwright/test";

const routes = [
  "/", "/certificates", "/verify", "/faq", "/contact",
  "/report-wrong-record", "/data-rights", "/terms", "/privacy",
  "/offline", "/maintenance", "/this-page-does-not-exist",
];

async function mockPublicApi(page: Page, populated: boolean) {
  const settings = populated ? {
    schoolName: "Satyam International School",
    tagline: "Learning for life",
    address: "School Road, India",
    phone: "+910000000000",
    email: "office@example.test",
    boardName: "CBSE",
    affiliationNumber: "123456",
    principalName: "Principal Test",
    principalMessage: "Welcome to our school.",
    principalPhotoUrl: "",
    announcement: { type: "info", textEn: "Admissions information", linkUrl: "" },
    socialLinks: [{ label: "Facebook", url: "https://facebook.com/example" }],
    lastUpdated: "31 October 2026",
    faqs: [{ questionEn: "How do I find certificates?", answerEn: "Use the certificate search page." }],
  } : { schoolName: "Satyam International School", faqs: [] };
  await page.route("**/api/public/site-settings", route =>
    route.fulfill({ status: 200, json: { settings } }));
  await page.route("**/api/public/sessions", route =>
    route.fulfill({ status: 200, json: { sessions: populated ? ["2025-26"] : [] } }));
}

async function checkPages(page: Page, populated: boolean) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => pageErrors.push(error.message));
  await mockPublicApi(page, populated);
  await page.addInitScript(() => {
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        render: (_element: HTMLElement, options: { callback: (token: string) => void }) => {
          options.callback("e2e-turnstile-token");
          return "e2e-turnstile-widget";
        },
        reset: () => {},
        remove: () => {},
      },
    });
  });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("undefined");
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `horizontal overflow on ${route}`).toBeLessThanOrEqual(dimensions.width + 1);
  }
  expect(pageErrors, "uncaught browser errors").toEqual([]);
  expect(consoleErrors, "browser console errors").toEqual([]);
}

test("all public routes render cleanly with an empty public database", async ({ page }) => {
  await checkPages(page, false);
});

test("all public routes render cleanly with populated public data", async ({ page }) => {
  await checkPages(page, true);
});

test("certificate search has a neutral disabled empty-session state", async ({ page }) => {
  await mockPublicApi(page, false);
  await page.addInitScript(() => {
    Object.defineProperty(window, "turnstile", { configurable: true, value: { render: () => "test", reset: () => {}, remove: () => {} } });
  });
  await page.goto("/certificates");
  const session = page.locator('select[name="session"]');
  await expect(session).toBeDisabled();
  await expect(session.locator("option")).toHaveCount(1);
  await expect(session.locator("option").first()).toHaveText("No data found");
  await expect(page.getByRole("button", { name: /find|search/i })).toBeDisabled();
  await expect(page.getByText(/No published sessions are currently available/i)).toBeVisible();
});
