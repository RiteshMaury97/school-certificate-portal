import { describe, expect, it } from "vitest";

import {
  calculateBreachDeadlines,
  dueBreachReminderMilestones,
  dueReminderHours,
  isBoardReportOverdue,
} from "../src/shared/breach-deadlines";
import { generateBreachDraft } from "../src/shared/breach-drafts";
import { breachCsv, breachReportLines } from "../src/shared/breach-export";

const discovered = "2026-11-01T00:00:00.000Z";

describe("breach deadline and export helpers", () => {
  it("calculates immediate notification and 72-hour Board deadlines from discovery", () => {
    const deadlines = calculateBreachDeadlines(discovered, new Date("2026-11-01T12:00:00.000Z"));
    expect(deadlines.map((item) => item.dueAt.toISOString())).toEqual([
      discovered,
      discovered,
      "2026-11-04T00:00:00.000Z",
    ]);
    expect(deadlines[0]?.overdue).toBe(false);
    expect(deadlines[2]?.remainingMs).toBe(60 * 3_600_000);
  });

  it("detects reminders only after the configured elapsed milestones", () => {
    expect(dueReminderHours(discovered, new Date("2026-11-02T00:00:00.000Z"))).toEqual([24]);
    expect(dueReminderHours(discovered, new Date("2026-11-03T18:00:00.000Z"))).toEqual([
      24, 48, 66,
    ]);
    expect(isBoardReportOverdue(discovered, new Date("2026-11-04T00:01:00.000Z"))).toBe(true);
    expect(
      isBoardReportOverdue(
        discovered,
        new Date("2026-11-04T00:01:00.000Z"),
        "2026-11-03T23:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("selects reached milestones on daily runs and the 30-hour Board pre-deadline reminder", () => {
    expect(dueBreachReminderMilestones(discovered, new Date("2026-11-03T18:00:00.000Z"))).toEqual([
      "24",
      "48",
      "66",
      "due-within-30-hours",
    ]);
    expect(dueBreachReminderMilestones(discovered, new Date("2026-11-02T00:00:00.000Z"))).toEqual([
      "24",
    ]);
  });

  it("generates editable English and Hindi drafts without personal-data placeholders", () => {
    const incident = {
      summary: "A restricted student portal was accessed.",
      discoveredAt: discovered,
      systemsAffected: "Student portal",
      dataCategories: ["student-names"],
      likelyConsequences: "Records may have been viewed.",
      containmentActions: "Access was disabled.",
    };
    const english = generateBreachDraft(incident, "board", {
      name: "Grievance Officer",
      email: "privacy@example.test",
    });
    expect(english).toContain("Nature and extent:");
    expect(english).toContain("privacy@example.test");
    expect(english).not.toMatch(/\[(?:student|parent|name|email|phone)[^\]]*\]/i);
  });

  it("includes incident fields and immutable update timeline rows in exports", () => {
    const incident = { id: "case-1", title: "Portal access incident", status: "investigating" };
    const update = {
      at: discovered,
      byUid: "admin-1",
      note: "Access was isolated.",
      statusChange: "investigating",
    };
    expect(breachCsv([incident], [update])).toContain(
      '"update","case-1","statusChange","Access was isolated."',
    );
    expect(breachReportLines(incident, [update]).join("\n")).toContain("Update timeline");
    expect(breachReportLines(incident, [update]).join("\n")).toContain("admin-1");
  });
});
