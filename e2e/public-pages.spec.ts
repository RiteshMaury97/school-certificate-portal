import { expect, test } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        render: (
          _element: HTMLElement,
          options: { callback: (token: string) => void },
        ) => {
          options.callback("e2e-token");
          return "e2e-widget";
        },
        reset: () => { return; },
        remove: () => { return; },
      },
    });
  });
  await page.route("**/api/public/site-settings", (route) =>
    route.fulfill({ json: { settings: { schoolName: "Test School" } } }),
  );
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ json: { sessions: ["2023-24"] } }),
  );
});
test("home page loads with a main landmark", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
});
test("verify page is reachable", async ({ page }) => {
  await page.goto("/verify");
  await expect(page.locator("main")).toBeVisible();
});
test("unknown route shows a helpful not-found state", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByText(/not found/i)).toBeVisible();
});
test("language and dark mode preferences persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#language-toggle").selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  const theme = page.getByRole("button", { name: /theme/i });
  await theme.click(); // system -> light
  await theme.click(); // light -> dark
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("#language-toggle")).toHaveValue("hi");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
