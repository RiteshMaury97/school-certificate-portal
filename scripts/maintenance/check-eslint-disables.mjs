import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ignored = new Set([".git", ".next", "node_modules", "reports", "coverage"]);
const extensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const violations = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) await walk(join(directory, entry.name));
      continue;
    }
    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    if (!extensions.has(extension)) continue;
    const file = join(directory, entry.name);
    const lines = (await readFile(file, "utf8")).split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      if (/eslint[-]disable(?:-next-line|-line)?\b/u.test(line) && !/--\s*reason:\s*\S/u.test(line)) {
        violations.push(`${relative(process.cwd(), file)}:${index + 1}: add "-- reason: <explanation>" on this line`);
      }
    }
  }
}

await walk(process.cwd());
if (violations.length) {
  console.error("ESLint suppressions require a same-line reason:\n" + violations.join("\n"));
  process.exitCode = 1;
}
