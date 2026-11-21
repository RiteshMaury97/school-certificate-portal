/** User-facing date format. Date-only values stay ISO internally. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return `${String(parsed.getDate()).padStart(2, "0")}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${parsed.getFullYear()}`;
}

export function formatDateTime(value: string | null | undefined, timeZone?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  const date = timeZone
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone,
      })
        .format(parsed)
        .replaceAll("/", "-")
    : formatDate(parsed.toISOString());
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(timeZone ? { timeZone } : {}),
  }).format(parsed);
  return `${date} ${time}`;
}

/** Accept dd-mm-yyyy and legacy yyyy-mm-dd, returning canonical yyyy-mm-dd. */
export function normalizeDateInput(value: string): string {
  const trimmed = value.trim();
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return trimmed;
}
