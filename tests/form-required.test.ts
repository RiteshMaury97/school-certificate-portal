import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { formExceptions } from "../src/shared/form-exceptions";

describe("required form controls", () => {
  it("keeps documented exceptions explicit and meaningful", () => {
    expect(Object.keys(formExceptions)).toEqual([
      "search and filter controls",
      "single non-consent checkboxes",
      "conditionally shown fields",
      "optional notes",
    ]);
    for (const reason of Object.values(formExceptions)) expect(reason.length).toBeGreaterThan(20);
  });

  it("marks all non-exempt source controls required and accessibly required", async () => {
    const failures: string[] = [];
    async function walk(directory: string): Promise<string[]> {
      const entries = await readdir(directory, { withFileTypes: true });
      const nested = await Promise.all(
        entries.map(async (entry) => {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) return walk(file);
          return /\.(?:tsx|jsx)$/.test(entry.name) ? [file] : [];
        }),
      );
      return nested.flat();
    }
    for (const file of await walk("src")) {
      const source = await readFile(file, "utf8");
      const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.JSX;
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
      function visit(node: ts.Node): void {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText(ast);
          if (["input", "select", "textarea"].includes(tag)) {
            const attrs = node.attributes.properties
              .map((property) => property.getText(ast))
              .join(" ");
            const has = (name: string) =>
              node.attributes.properties.some(
                (property) => ts.isJsxAttribute(property) && property.name.getText(ast) === name,
              );
            const exempt =
              /(?:search|filter)/i.test(attrs) ||
              (/type\s*=\s*["']checkbox["']/.test(attrs) && !/consent/i.test(attrs)) ||
              /(?:optional|conditionally|phoneOptIn)/i.test(attrs) ||
              /(?:note|comment)/i.test(attrs) ||
              /type\s*=\s*["'](?:hidden|submit|button|reset)["']/i.test(attrs);
            if (!exempt && (!has("required") || !has("aria-required"))) {
              failures.push(`${file}: <${tag}>`);
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
    expect(failures).toEqual([]);
  }, 15_000);
});
