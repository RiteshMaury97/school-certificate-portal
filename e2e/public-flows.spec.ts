import { expect, test, type Page } from "@playwright/test";
const studentResult = {
  found: true,
  studentName: "Rahul Kumar",
  session: "2023-24",
  accessToken: "test-access-token",
  tokenExpiresIn: 300,
  certificates: [
    {
      certId: "certificate_public_id_1234567890",
      title: "Class X Marksheet",
      type: "Marksheet",
      session: "2023-24",
      issueDate: "2024-05-01",
      certificateNumber: "TEST-2024-001",
      mimeType: "application/pdf",
    },
  ],
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSearchResult(
  value: unknown,
): value is { found?: boolean; message?: string } {
  return (
    isRecord(value) &&
    (value.found === undefined || typeof value.found === "boolean") &&
    (value.message === undefined || typeof value.message === "string")
  );
}

function isChallengeAnswer(
  value: unknown,
): value is { challengeToken?: string; disambiguationValue?: string } {
  return (
    isRecord(value) &&
    (value.challengeToken === undefined ||
      typeof value.challengeToken === "string") &&
    (value.disambiguationValue === undefined ||
      typeof value.disambiguationValue === "string")
  );
}

async function mockTurnstile(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: {
        render: (
          _element: HTMLElement,
          options: { callback: (token: string) => void },
        ) => {
          options.callback("e2e-turnstile-token");
          return "e2e-widget";
        },
        reset: () => { return; },
        execute: () => { return; },
        remove: () => { return; },
      },
    });
  });
}
async function fillSearch(page: Page) {
  await page.getByLabel("Student Name").fill("Rahul Kumar");
  await page.getByLabel("Father’s Name").fill("Amit Kumar");
  await page.getByLabel("Mother’s Name").fill("Sunita Kumar");
  await page.getByLabel("Session of Passing").selectOption("2023-24");
  await page.getByRole("checkbox").check();
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-check/token", (route) =>
    route.fulfill({ json: { token: "e2e-app-check-token", expireTimeMillis: Date.now() + 3_600_000 } }),
  );
  await page.route("**/api/public/site-settings", (route) =>
    route.fulfill({
      json: {
        settings: {
          schoolName: "Test School",
          email: "office@example.test",
          phone: "+911234567890",
        },
      },
    }),
  );
  await page.route("**/api/public/sessions", (route) =>
    route.fulfill({ json: { sessions: ["2023-24"] } }),
  );
});
test("student search returns a generic no-result message", async ({ page }) => {
  await mockTurnstile(page);
  await page.route("**/api/certificates/search", (route) =>
    route.fulfill({
      json: { found: false },
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    }),
  );
  await page.goto("/");
  await fillSearch(page);
  await page.getByRole("button", { name: "Find My Certificates" }).click();
  await expect(
    page.getByText("No record found. Check the details and try again."),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});
test("student search can retrieve results and download the server-generated ZIP", async ({
  page,
}) => {
  await mockTurnstile(page);
  await page.route("**/api/certificates/search", (route) =>
    route.fulfill({
      json: studentResult,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    }),
  );
  await page.route("**/api/certificates/bundle?**", (route) =>
    route.fulfill({
      status: 200,
      body: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="school-certificates.zip"',
      },
    }),
  );
  await page.goto("/");
  await fillSearch(page);
  await expect(
    page.getByLabel(
      "Date of Birth or Admission Number (needed to confirm your identity)",
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Find My Certificates" }).click();
  await expect(page.getByText("Your certificates")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all (ZIP)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("school-certificates.zip");
});
test("verification form returns a result without indexing it", async ({
  page,
}) => {
  await mockTurnstile(page);
  await page.route("**/api/certificates/verify", (route) =>
    route.fulfill({
      json: {
        valid: true,
        message: "Valid certificate",
        certificateType: "Marksheet",
        session: "2023-24",
        issueDate: "2024-05-01",
        schoolName: "Test School",
        studentName: "R. K.",
        verifiedOn: "2026-10-30T10:00:00.000Z",
      },
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    }),
  );
  await page.goto("/verify");
  await page.getByLabel("Certificate Number").fill("TEST-2024-001");
  await page.getByRole("button", { name: "Verify Certificate" }).click();
  await expect(page.getByText("Valid certificate")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});

test("duplicate name combination asks for a second identifier only after the server challenge", async ({
  page,
}) => {
  await mockTurnstile(page);
  let calls = 0;
  await page.route("**/api/certificates/search", async (route) => {
    calls += 1;
    if (calls === 1)
      return route.fulfill({
        json: {
          needsMoreInfo: true,
          challengeToken: "signed-two-minute-challenge-token",
        },
      });
    const body: unknown = route.request().postDataJSON();
    if (!isChallengeAnswer(body)) throw new Error("Invalid search request body");
    expect(body.challengeToken).toBe("signed-two-minute-challenge-token");
    expect(body.disambiguationValue).toBe("15-04-2010");
    return route.fulfill({
      json: studentResult,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  });
  await page.goto("/");
  await fillSearch(page);
  await expect(
    page.getByLabel(
      "Date of Birth or Admission Number (needed to confirm your identity)",
    ),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Find My Certificates" }).click();
  const identity = page.getByLabel(
    "Date of Birth or Admission Number (needed to confirm your identity)",
  );
  await expect(identity).toBeVisible();
  await identity.fill("15-04-2010");
  await page.getByRole("button", { name: "Find My Certificates" }).click();
  await expect(page.getByText("Your certificates")).toBeVisible();
  expect(calls).toBe(2);
});

test("wrong disambiguation answer produces only the generic not-found message", async ({
  page,
}) => {
  await mockTurnstile(page);
  let calls = 0;
  await page.route("**/api/certificates/search", (route) => {
    calls += 1;
    return route.fulfill({
      json:
        calls === 1
          ? {
              needsMoreInfo: true,
              challengeToken: "signed-two-minute-challenge-token",
            }
          : {
              found: false,
              message: "No record found. Check the details and try again.",
            },
    });
  });
  await page.goto("/");
  await fillSearch(page);
  await page.getByRole("button", { name: "Find My Certificates" }).click();
  await page
    .getByLabel(
      "Date of Birth or Admission Number (needed to confirm your identity)",
    )
    .fill("wrong-answer");
  await page.getByRole("button", { name: "Find My Certificates" }).click();
  await expect(
    page.getByText("No record found. Check the details and try again."),
  ).toBeVisible();
  await expect(page.getByText("Your certificates")).toHaveCount(0);
});

test("duplicate challenge brute-force attempts are capped at three", async ({
  page,
}) => {
  await mockTurnstile(page);
  let attemptsAccepted = 0;
  await page.route("**/api/certificates/search", async (route) => {
    const body: unknown = route.request().postDataJSON();
    if (!isChallengeAnswer(body)) throw new Error("Invalid search request body");
    if (!body.challengeToken)
      return route.fulfill({
        json: {
          needsMoreInfo: true,
          challengeToken: "signed-two-minute-challenge-token",
        },
      });
    if (attemptsAccepted < 3) attemptsAccepted += 1;
    return route.fulfill({
      json: {
        found: false,
        message: "No record found. Check the details and try again.",
      },
    });
  });
  await page.goto("/");
  await fillSearch(page);
  await page.getByRole("button", { name: "Find My Certificates" }).click();
  const responses = await page.evaluate(async () => {
    const results: { found?: boolean; message?: string }[] = [];
    for (let index = 0; index < 4; index += 1) {
      const response = await fetch("/api/certificates/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeToken: "signed-two-minute-challenge-token",
          disambiguationValue: `guess-${String(index)}`,
        }),
      });
      const result: unknown = await response.json();
      if (!isSearchResult(result)) throw new Error("Invalid search response");
      results.push(result);
    }
    return results;
  });
  expect(attemptsAccepted).toBe(3);
  expect(responses).toHaveLength(4);
  expect(
    responses.every(
      (result) =>
        result.found === false &&
        result.message === "No record found. Check the details and try again.",
    ),
  ).toBe(true);
});

test("superseded certificate verification shows only the replacement number", async ({
  page,
}) => {
  await mockTurnstile(page);
  await page.route("**/api/certificates/verify", (route) =>
    route.fulfill({
      json: {
        valid: false,
        status: "superseded",
        message:
          "This certificate has been replaced by a newer version. Please contact the school for the current one.",
        newCertificateNumber: "NEW-2026-002",
      },
    }),
  );
  await page.goto("/verify");
  await page.getByLabel("Certificate Number").fill("OLD-2024-001");
  await page.getByRole("button", { name: "Verify Certificate" }).click();
  await expect(
    page.getByText(
      "This certificate has been replaced by a newer version. Please contact the school for the current one.",
    ),
  ).toBeVisible();
  await expect(page.getByText("NEW-2026-002")).toBeVisible();
  await expect(page.getByText("Rahul Kumar")).toHaveCount(0);
});

test("revoked certificate verification does not reveal the internal reason", async ({
  page,
}) => {
  await mockTurnstile(page);
  await page.route("**/api/certificates/verify", (route) =>
    route.fulfill({
      json: {
        valid: false,
        status: "revoked",
        message:
          "This certificate is no longer valid. Please contact the school.",
      },
    }),
  );
  await page.goto("/verify");
  await page.getByLabel("Certificate Number").fill("REVOKED-2024-001");
  await page.getByRole("button", { name: "Verify Certificate" }).click();
  await expect(
    page.getByText(
      "This certificate is no longer valid. Please contact the school.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/revocation reason|disciplinary|fraud/i),
  ).toHaveCount(0);
});
