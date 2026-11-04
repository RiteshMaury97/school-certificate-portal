import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { responsiveRoutes, viewports, type AuditRow } from "./responsive-audit";

export default async function responsiveReport() {
  const root = path.resolve("reports", "responsive");
  const rawDirectory = path.join(root, "raw");
  const names = await readdir(rawDirectory).catch(() => []);
  const rows: AuditRow[] = [];
  for (const name of names.filter((file) => file.endsWith(".json"))) {
    const contents = await readFile(path.join(rawDirectory, name), "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (Array.isArray(parsed)) rows.push(...parsed.filter(isAuditRow));
  }
  if (rows.length === 0) return;
  const labels = viewports.map(([width, height]) => `${String(width)}×${String(height)}`);
  const header = `| Route | Fixture | ${labels.join(" | ")} |`;
  const separator = `|---|---|${labels.map(() => "---").join("|")}|`;
  const table = responsiveRoutes.map((route) => {
    const fixture = rows.find((row) => row.route === route)?.fixture ?? "missing";
    const cells = viewports.map(([width, height]) => {
      const combination = rows.filter(
        (row) => row.route === route && row.viewport === `${String(width)}x${String(height)}`,
      );
      return ["light", "dark", "contrast"]
        .map((theme) => {
          const row = combination.find((entry) => entry.theme === theme);
          return `${theme[0]?.toUpperCase() ?? "?"}:${row ? (row.failures.length ? "FAIL" : "PASS") : "N/A"}`;
        })
        .join(" ");
    });
    return `| ${route} | ${fixture} | ${cells.join(" | ")} |`;
  });
  const failedRows = rows.filter((row) => row.failures.length);
  const failedChecks = new Map<string, number>();
  for (const row of failedRows)
    for (const failure of row.failures) {
      const check = failure.split("=")[0] ?? "unknown";
      failedChecks.set(check, (failedChecks.get(check) ?? 0) + 1);
    }
  const details = failedChecks.size
    ? [...failedChecks]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, count]) => `- ${name}: ${String(count)} failing combinations`)
        .join("\n")
    : "No failing checks.";
  const summary = `# Responsive audit baseline\n\n- Captured: ${new Date().toISOString()}\n- Browser: Chromium via Playwright\n- Combinations: ${String(rows.length)} (route × viewport × theme)\n- Passing combinations: ${String(rows.length - failedRows.length)}\n- Failing combinations: ${String(failedRows.length)}\n- Screenshots: reports/responsive/screenshots/\n\nEach viewport cell lists Light, Dark and High Contrast status (L/D/C).\n\n${header}\n${separator}\n${table.join("\n")}\n\n## Failed checks\n\n${details}\n\n## Raw records\n\nSee matrix.json for individual metric results and failure details.\n`;
  await writeFile(path.join(root, "matrix.json"), JSON.stringify(rows, null, 2));
  await writeFile(path.join(root, "summary.md"), summary);
}

function isAuditRow(value: unknown): value is AuditRow {
  if (typeof value !== "object" || value === null) return false;
  return (
    "route" in value &&
    typeof value.route === "string" &&
    "viewport" in value &&
    typeof value.viewport === "string" &&
    "theme" in value &&
    (value.theme === "light" || value.theme === "dark" || value.theme === "contrast") &&
    "fixture" in value &&
    typeof value.fixture === "string" &&
    "checks" in value &&
    typeof value.checks === "object" &&
    value.checks !== null &&
    "failures" in value &&
    Array.isArray(value.failures) &&
    value.failures.every((failure) => typeof failure === "string")
  );
}
