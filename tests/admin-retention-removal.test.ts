import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("admin retention-review removal", () => {
  it("removes the review queue navigation, loader, and page while retaining backup/export tools", async () => {
    const consoleSource = await readFile("src/features/admin/AdminConsole.tsx", "utf8");
    const navigation = await readFile("src/features/admin/config/admin-navigation.ts", "utf8");
    const types = await readFile("src/features/admin/types/admin.types.ts", "utf8");
    const adminTools = await readFile("src/features/admin/components/admins/AdminProfileForms.tsx", "utf8");

    expect(consoleSource).not.toContain("RetentionTab");
    expect(consoleSource).not.toContain('tab === "retention"');
    expect(consoleSource).not.toContain("retentionRecords");
    expect(navigation).not.toContain('"retention"');
    expect(navigation).not.toContain("/admin/backup");
    expect(types).not.toContain('| "retention"');
    expect(adminTools).toContain("Export encrypted JSON");
    expect(adminTools).toContain("Export encrypted CSV");
    expect(adminTools).toContain("createBackup");
  });

  it("removes the retention scheduler and expiry-only code", async () => {
    const schedule = await readFile("vercel.json", "utf8");
    const createRoute = await readFile("src/app/api/admin/students/route.ts", "utf8");
    const updateRoute = await readFile("src/app/api/admin/students/[studentId]/route.ts", "utf8");
    const importRoute = await readFile("src/app/api/admin/students/import/route.ts", "utf8");

    expect(schedule).not.toContain("/api/cron/retention");
    for (const source of [createRoute, updateRoute, importRoute]) {
      expect(source).not.toContain("retentionExpiresAt");
      expect(source).not.toContain("retentionExpiryFromSession");
    }
  });
});
