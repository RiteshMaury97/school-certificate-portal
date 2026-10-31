export const ADMIN_IDLE_TIMEOUT_MS = 15 * 60_000;
export const ADMIN_IDLE_WARNING_MS = 13 * 60_000;
export const ADMIN_HARD_SESSION_LIMIT_MS = 8 * 60 * 60_000;
export function isAdminSessionExpired(
  lastActivityAt: number,
  absoluteExpiresAt: number,
  now = Date.now(),
): boolean {
  return (
    !Number.isFinite(lastActivityAt) ||
    !Number.isFinite(absoluteExpiresAt) ||
    lastActivityAt <= 0 ||
    absoluteExpiresAt <= 0 ||
    now - lastActivityAt >= ADMIN_IDLE_TIMEOUT_MS ||
    now >= absoluteExpiresAt
  );
}
