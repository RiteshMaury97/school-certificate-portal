/** Normalize supported academic year labels to the stored YYYY-YY format. */
export function normalizeAcademicSession(value: string): string | null {
  const compact = value.trim().replace(/\s+/g, "");
  const shortYear = /^(\d{4})-(\d{2})$/.exec(compact);
  if (shortYear?.[1] && shortYear[2]) return `${shortYear[1]}-${shortYear[2]}`;

  const fullYear = /^(\d{4})-(\d{4})$/.exec(compact);
  if (fullYear?.[1] && fullYear[2] && Number(fullYear[2]) === Number(fullYear[1]) + 1) {
    return `${fullYear[1]}-${fullYear[2].slice(-2)}`;
  }

  return null;
}
