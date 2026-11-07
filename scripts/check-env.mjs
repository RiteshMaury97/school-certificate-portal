import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const typescript = require("typescript");
const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/server/env.ts");
require.extensions[".ts"] = (module, typescriptFilename) => {
  const source = require("node:fs").readFileSync(typescriptFilename, "utf8");
  const compiled = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
    fileName: typescriptFilename,
  }).outputText;
  module._compile(compiled, typescriptFilename);
};

const { validateServerEnvironment } = require(filename);
const result = validateServerEnvironment(process.env);
process.stdout.write(`Environment validation (${result.deployment})\n`);
for (const check of result.checks) {
  process.stdout.write(`${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.message}\n`);
}
if (!result.valid) process.exitCode = 1;
