export type AdminRole = "uploader" | "approver" | "superadmin";
export function hasAnyRole(
  role: AdminRole,
  allowed: readonly AdminRole[],
): boolean {
  return role === "superadmin" || allowed.includes(role);
}
export function canReviewUpload(
  actorUid: string,
  uploaderUid: string,
): boolean {
  return (
    actorUid.length > 0 && uploaderUid.length > 0 && actorUid !== uploaderUid
  );
}
