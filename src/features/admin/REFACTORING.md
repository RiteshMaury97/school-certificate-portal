# Admin console extraction

`AdminConsole.tsx` now acts as a 396-line controller and composition root. The view bodies, shell, navigation, feedback banners, and dialogs live in focused components. Admin data, session lifecycle, certificate intake, bulk imports, approvals, site settings, certificate history, and admin user actions live in hooks.

The combined `load` callback remains memoized with its original dependencies (`tab`, `api`, `loadStudents`, `catalogKind`, audit filters, `role`, and `timelineStudentId`), preserving the `[email, load]` reload behavior. Audit filters continue to reload on each keystroke. Existing prompt, confirmation, alert, API, and role-gating flows were moved with their handlers.

The sidebar, hidden rendered navigation, and mobile navigation keep their separate label variants. The shared visible-tab filter is in `utils/admin-tab-access.ts`. The three duplicate-hash warning usages keep their original wrapper class variants.

## Verification

- `npm run typecheck` passes.
- `npm run build` passes.
- The focused `tests/empty-error-states.test.ts` passes after updating its source contract to follow the extracted student list and form components.
- The full Vitest suite had 6 failing files and 9 failing tests before the admin source-contract assertion was updated. Those remaining failures cover public page contracts, design tokens, mailer configuration, missing Firebase test configuration, and a mocked admin route export; the full suite was not rerun after updating that assertion.
- Admin source files are kept at or below 400 lines; `AdminConsole.tsx` is 396 lines.
- The repository lint configuration still reports errors when linting the admin folder, including import ordering, type-only import, and existing complexity/async-handler rules. The project-wide lint command also fails while processing its own config because type-aware rules are applied to `eslint.config.mjs` without type information.
