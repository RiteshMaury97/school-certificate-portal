# Frontend route architecture

## Application entry

- `app/[[...slug]]/page.tsx` mounts `AppRouterMount`.
- `src/app/AppRouterMount.tsx` uses a client-only Next dynamic import (`ssr: false`).
- `src/app/AppRouter.tsx` owns `BrowserRouter`, providers, the error boundary and a `Suspense` skeleton.
- `src/app/routes.tsx` declares every route with `React.lazy`.

## Page modules

Every public and admin route has an individual module under `src/pages/public` or `src/pages/admin`. Each module uses `usePageMeta`, backed by `react-helmet-async`, to set the page title, description and robots directives. Public information pages are indexable. Results, print, and administration pages are noindex. The Verify page switches to noindex while a verification result is displayed.

## Shared modules

- `src/components/layout`: public/admin shells, navigation and page headers.
- `src/components/ui`: touch-friendly controls and display primitives.
- `src/components/feedback`: skeleton, empty/error states, banner and loading feedback.
- `src/features`: certificate search/results, verification, theme, translation, authentication and admin feature modules.
- `src/hooks`, `src/lib`, `src/styles`, and `src/types`: shared hooks, utilities, tokens and types.

## Security and data handling

- Existing `app/api/**` handlers were not changed.
- Search result data is passed to the results/print screens using React Router location state, not student PII in route parameters, query strings or hashes.
- Download links continue to use the existing short-lived signed access token.

## Migration caveat

The existing `src/screens/AdminPage.tsx`, `src/screens/FinderPage.tsx`, and `src/lib/security.ts` remain legacy files above the requested 600-line limit. Page entry modules are split and lazy-loaded, but the legacy admin workspace and certificate search still need a behavior-preserving extraction into feature components before the entire repository meets the 600-line rule. The admin route entry files currently reuse the existing admin workspace to preserve its existing security and approval behavior.

## Dependency setup

`react-helmet-async` is declared in `package.json`. The package-lock could not be refreshed in this environment; run `npm install` once before using `npm ci` in CI or deployment so the lockfile includes this dependency.
