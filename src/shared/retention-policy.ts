export function retentionExpiryFromSession(
  session: string,
  years: number,
): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(session);
  if (!match) return null;
  const start = Number(match[1]),
    end = Number(match[2]);
  const endYear = end < 100 ? Math.floor(start / 100) * 100 + end : end;
  if (
    endYear < start ||
    endYear > start + 2 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 30
  )
    return null;
  return new Date(Date.UTC(endYear + years, 2, 31, 23, 59, 59));
}
export function isRetentionExpired(
  expiry: Date | null,
  now = new Date(),
): boolean {
  return Boolean(expiry && expiry.getTime() <= now.getTime());
}
