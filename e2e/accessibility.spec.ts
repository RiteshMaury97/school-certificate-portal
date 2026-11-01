import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
test("public home has no serious or critical axe violations", async ({
  page,
}) => {
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
    route.fulfill({ json: { settings: {} } }),
  );
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ json: { sessions: ["2023-24"] } }),
  );
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter(
    (item) => item.impact === "critical" || item.impact === "serious",
  );
  expect(
    blocking,
    JSON.stringify(
      blocking.map((item) => ({ id: item.id, nodes: item.nodes.length })),
    ),
  ).toEqual([]);
});
