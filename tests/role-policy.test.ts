import { describe, expect, it } from "vitest";
import { canReviewUpload, hasAnyRole } from "../src/shared/role-policy";
describe("server role policy", () => {
  it("grants superadmins all explicitly gated capabilities", () => {
    expect(hasAnyRole("superadmin", ["approver"])).toBe(true);
    expect(hasAnyRole("uploader", ["approver"])).toBe(false);
    expect(hasAnyRole("approver", ["approver"])).toBe(true);
  });
  it("prevents the uploader from reviewing their own submission", () => {
    expect(canReviewUpload("approver-1", "uploader-1")).toBe(true);
    expect(canReviewUpload("uploader-1", "uploader-1")).toBe(false);
    expect(canReviewUpload("", "uploader-1")).toBe(false);
  });
});
