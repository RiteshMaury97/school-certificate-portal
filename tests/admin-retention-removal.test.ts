import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("admin retention review removal", () => {
  it("removes the review tab and queue loader while preserving backup and export actions", async () => {
    const consoleSource = await readFile("src/features/admin/AdminConsole.tsx", "utf8");
    const navigation = await readFile("src/features/admin/config/admin-navigation.ts", "utf8");
    const dataLoader = await readFile("src/features/admin/hooks/useAdminData.ts", "utf8");
    const userActions = await readFile("src/features/admin/hooks/useAdminUsers.ts", "utf8");
    expect(consoleSource).not.toContain("RetentionTab");
    expect(consoleSource).not.toContain("retentionRecords");
    expect(navigation).not.toContain("Retention Review");
    expect(navigation).not.toContain("/admin/backup");
    expect(dataLoader).not.toContain("/api/admin/retention-review");
    expect(userActions).toContain("/api/admin/backup");
    expect(userActions).toContain("export");
  });

  it("removes the scheduled review job without affecting the encrypted backup schedule", async () => {
    const config = await readFile("vercel.json", "utf8");
    expect(config).not.toContain("/api/cron/retention");
    expect(config).toContain("/api/admin/backup");
  });
});
