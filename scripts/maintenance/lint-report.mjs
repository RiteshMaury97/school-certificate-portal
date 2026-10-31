import { mkdir, writeFile } from "node:fs/promises";
import { ESLint } from "eslint";

const reportDirectory = new URL("../reports/", import.meta.url);
await mkdir(reportDirectory, { recursive: true });

const eslint = new ESLint();
const results = await eslint.lintFiles(["."]);
const formatter = await eslint.loadFormatter("html");
const html = await formatter.format(results);
const json = JSON.stringify(results, null, 2);

await Promise.all([
  writeFile(new URL("eslint-report.html", reportDirectory), html, "utf8"),
  writeFile(new URL("eslint-report.json", reportDirectory), json, "utf8"),
]);

const errors = results.reduce((total, result) => total + result.errorCount, 0);
const warnings = results.reduce((total, result) => total + result.warningCount, 0);
const fixable = results.reduce(
  (total, result) => total + result.fixableErrorCount + result.fixableWarningCount,
  0,
);

console.log(`ESLint report saved. Errors: ${errors}; warnings: ${warnings}; fixable: ${fixable}.`);
if (errors > 0 || warnings > 0) process.exitCode = 1;
