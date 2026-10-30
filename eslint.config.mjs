import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import next from "@next/eslint-plugin-next";
import importPlugin from "eslint-plugin-import";
import security from "eslint-plugin-security";
import promise from "eslint-plugin-promise";
import unicorn from "eslint-plugin-unicorn";
import prettier from "eslint-config-prettier";

const typedFiles = ["**/*.{ts,tsx,mts,cts}"];
const jsxA11yRules = {
  ...jsxA11y.configs.recommended.rules,
  ...jsxA11y.configs.strict.rules,
};
const jsxA11yErrors = Object.fromEntries(
  Object.keys(jsxA11yRules).map((rule) => [rule, "error"]),
);

export default defineConfig([
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "reports/**",
    "next-env.d.ts",
  ]),
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: typedFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-unsafe-optional-chaining": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      complexity: ["error", 12],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "max-lines": [
        "error",
        { max: 600, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "@next/next": next,
      import: importPlugin,
      security,
      promise,
      unicorn,
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        typescript: { alwaysTryTypes: true },
        node: true,
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11yErrors,
      ...next.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-uses-react": "off",
      "react/jsx-uses-vars": "error",
      "react/no-danger": "error",
      "react-hooks/exhaustive-deps": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling", "index"],
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-cycle": ["error", { maxDepth: 2 }],
      "security/detect-unsafe-regex": "error",
      "security/detect-eval-with-expression": "error",
      "promise/always-return": "off",
      "promise/catch-or-return": "error",
      "promise/no-nesting": "warn",
      "unicorn/error-message": "error",
      "unicorn/no-array-for-each": "error",
      "unicorn/prefer-string-slice": "error",
      "unicorn/prefer-number-properties": "error",
      "unicorn/no-useless-undefined": "error",
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      complexity: ["error", 12],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "max-lines": [
        "error",
        { max: 600, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
    },
  },
  prettier,
]);
