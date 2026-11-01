# Linting and code size

Run `npm run lint` for ESLint, `npm run typecheck` for TypeScript, `npm test` for unit tests, and `npx prettier --check .` for formatting. CI runs lint before typecheck, tests, and build; a non-zero lint result fails the quality job and blocks pull request checks.

Lint enforces at most 600 nonblank, noncomment lines per file; 120 per function; complexity 12; nesting depth 3; and 4 parameters. Keep helpers focused and extract cohesive components, hooks, or utilities when a file or function approaches a limit.

Do not suppress lint errors as a shortcut. When a rule has a proven false positive and no behavior-preserving code fix is possible, use one narrow directive immediately before the affected line, with the rule and a specific explanation:

```ts
// eslint-disable-next-line <rule> -- reason: <specific explanation>
```

To split an oversized file, move related types and pure helpers into focused modules, extract UI into small components or hooks, and keep the original public import path stable with re-exports when needed. Update tests that read source files by path to use the new locations without weakening their assertions. Re-run lint, typecheck, and tests after each refactor group.
