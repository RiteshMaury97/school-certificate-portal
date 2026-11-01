import { expect, test } from "@playwright/test";
test("superadmin can upload a certificate and approve a pending record", async ({ page }) => {
  let published = false;
  await page.addInitScript(() => {
    Object.defineProperty(window, "grecaptcha", {
      configurable: true,
      value: {
        ready: (callback: () => void) => {
          callback();
        },
        execute: () => Promise.resolve("e2e-recaptcha-token"),
      },
    });
  });
  await page.route("**/firebaseappcheck.googleapis.com/**", (route) =>
    route.fulfill({ json: { token: "e2e-app-check-token", ttl: "3600s" } }),
  );
  const student = {
    id: "student-1234567890123456",
    admissionNo: "1001",
    studentName: "Rahul Kumar",
    fatherName: "Amit Kumar",
    motherName: "Sunita Kumar",
    session: "2023-24",
    certificateCount: 0,
  };
  const pendingCertificate = {
    id: "cert-1234567890123456",
    studentId: student.id,
    session: "2023-24",
    type: "Marksheet",
    issueDate: "2024-05-01",
    fileName: "marksheet.pdf",
    status: "pending",
    uploadedBy: "different-uploader",
  };
  await page.route("**/api/admin/session", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: {
            uid: "approver-uid",
            email: "admin@example.test",
            role: "superadmin",
          },
        })
      : route.fulfill({ json: { ok: true } }),
  );
  await page.route("**/api/admin/students/list", (route) =>
    route.fulfill({ json: { students: [student] } }),
  );
  await page.route("**/api/admin/catalog/sessions", (route) =>
    route.fulfill({ json: { items: [{ id: "2023-24", label: "2023-24" }] } }),
  );
  await page.route("**/api/admin/catalog/certificateTypes", (route) =>
    route.fulfill({
      json: { items: [{ id: "marksheet", name: "Marksheet" }] },
    }),
  );
  await page.route("**/api/admin/certificates**", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ json: { ok: true } });
    if (route.request().url().includes("status=pending"))
      return route.fulfill({
        json: { certificates: published ? [] : [pendingCertificate] },
      });
    return route.fulfill({
      json: {
        certificates: published ? [{ ...pendingCertificate, status: "published" }] : [],
      },
    });
  });
  await page.route("**/api/admin/certificates/*/preview", (route) =>
    route.fulfill({
      json: {
        url: "https://example.test/private-preview.pdf",
        mimeType: "application/pdf",
        expiresIn: 60,
      },
    }),
  );
  await page.route("**/api/admin/certificates/*/decision", async (route) => {
    published = true;
    await route.fulfill({ json: { ok: true, status: "published" } });
  });
  await page.goto("/admin");
  await expect(page.getByText("School Admin Dashboard")).toBeVisible();
  await page.getByRole("button", { name: "certificates", exact: true }).click();
  await page.getByLabel("Session", { exact: true }).selectOption("2023-24");
  await page.getByLabel("Certificate type").selectOption("Marksheet");
  await page.getByLabel("Certificate number").fill("E2E-2024-001");
  await page.getByLabel("Issue date").fill("2024-05-01");
  await page.getByLabel("Finished certificate file").setInputFiles({
    name: "marksheet.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 test"),
  });
  await page.getByRole("button", { name: "Upload certificate" }).click();
  await expect(page.getByText("Changes saved successfully.")).toBeVisible();
  await page.getByRole("button", { name: "Pending approvals" }).click();
  await expect(page.getByText("Pending certificate approvals")).toBeVisible();
  await page.getByRole("button", { name: "Load 60-second preview" }).click();
  await page.getByLabel("Details match the document").check();
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await expect.poll(() => published).toBe(true);
});
