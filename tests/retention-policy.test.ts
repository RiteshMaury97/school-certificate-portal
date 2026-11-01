import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("student record retention disclosure", () => {
  it("keeps the configured retention period and describes manual deletion", async () => {
    const privacy = await readFile("src/features/legal/PrivacyView.tsx", "utf8");
    const settings = await readFile("src/features/admin/components/site/BrandingTab.tsx", "utf8");
    expect(privacy).toContain("retentionYears} years");
    expect(privacy).toContain("verified erasure request");
    expect(privacy).toContain("authorized manual review");
    expect(privacy).not.toContain("flagged for a human");
    expect(privacy).not.toContain("retentionScheduleConfirmed");
    expect(settings).toContain("Retention period after the end of the academic session");
  });
});
