import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const { Module } = require("node:module");

const typescript = require("typescript");
const filename = path.resolve("src/server/env.ts");
const source = await import("node:fs/promises").then((fs) => fs.readFile(filename, "utf8"));
const compiled = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022,
  },
}).outputText;
const loaded = new Module(filename);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);

const result = loaded.exports.validateServerEnvironment(process.env);
process.stdout.write(`Environment validation (${result.deployment})\n`);
for (const check of result.checks) {
  process.stdout.write(`${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.message}\n`);
}
if (!result.valid) process.exitCode = 1;
