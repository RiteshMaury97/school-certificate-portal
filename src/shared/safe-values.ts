export function readText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

export function readStringRecord(value: unknown): Record<string, string> {
  const record = readRecord(value);
  if (!record) return {};
  return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, readText(entry)]));
}

export function readRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) => {
    const record = readRecord(entry);
    return record ? [record] : [];
  });
}

export function readErrorCode(value: unknown): string {
  if (typeof value !== "object" || value === null || !("code" in value)) return "";
  return readText(value.code);
}
