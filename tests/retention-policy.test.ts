import { describe, expect, it } from "vitest";
import {
  isRetentionExpired,
  retentionExpiryFromSession,
} from "@/src/lib/retention-policy";
describe("retention schedule", () => {
  it("calculates retention after the end of the academic session", () => {
    expect(retentionExpiryFromSession("2023-24", 7)?.toISOString()).toBe(
      "2031-03-31T23:59:59.000Z",
    );
  });
  it("rejects invalid sessions and periods", () => {
    expect(retentionExpiryFromSession("2023/24", 7)).toBeNull();
    expect(retentionExpiryFromSession("2023-24", 0)).toBeNull();
  });
  it("flags only records past the expiry", () => {
    expect(
      isRetentionExpired(new Date("2020-01-01"), new Date("2021-01-01")),
    ).toBe(true);
    expect(
      isRetentionExpired(new Date("2022-01-01"), new Date("2021-01-01")),
    ).toBe(false);
  });
});
