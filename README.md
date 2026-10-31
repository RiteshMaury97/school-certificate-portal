# School Certificate Portal

Next.js 16 (App Router) · React 19 · Firebase Auth + Firestore (Admin SDK) · Cloudflare R2 · Tailwind CSS 4

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in the values (see "Firebase credentials")
npm run dev
```

### Firebase credentials (server)
The server needs a service account to read Firestore and verify admin sessions.
1. Firebase console → Project settings → Service accounts → *Generate new private key*.
2. Encode it: `base64 -w0 service-account.json` → put the result in `FIREBASE_SERVICE_ACCOUNT_BASE64`.
3. **Delete the JSON file.** Never commit it. `.gitignore` blocks `service-account*.json`.

If the session picker shows *"Sessions could not be loaded"* or admin login fails, check the
server log: `[api/public/sessions]` / `[admin/session …]` lines now print a specific hint
(missing credentials, missing database, missing IAM role).

### Deploy Firestore rules and indexes
```bash
cp .firebaserc.example .firebaserc      # set your project id
npm run firebase:deploy:rules
```
Enable Firestore TTL on `expiresAt` for: `abuseCounters`, `adminLoginFailures`, `adminDevices`,
`adminSessionActions`, `adminReauthGrants`
(`gcloud firestore fields ttls update expiresAt --collection-group=<name> --enable-ttl`).

### First administrator
```bash
npm run admin:create-superadmin -- someone@school.example
```
The user must already exist in Firebase Auth with a verified email. On first sign-in they enrol an
authenticator app (TOTP); after that every sign-in needs password (or Google) **and** the 6-digit code.

## Project layout

```
src/
  app/              Next.js routes only (pages, layouts, API route handlers)
    (public pages)  page.tsx files: thin, they export metadata and render a feature view
    admin/          login, mfa, and (console)/ – one shared console layout for all sections
    api/            route handlers (public/, admin/, certificates/, cron/, health/)
  features/         the real UI, grouped by feature (auth, admin, certificates, verify, …)
  components/       shared UI: layout/, feedback/ (loaders, empty/error), providers/, ui/
  lib/              browser-only helpers (firebase client, site-settings hook, metadata helper)
  server/           server-only code (firebase-admin, security, R2, PII, watermark …)
  shared/           pure logic used by both browser and server (validation, policies)
  styles/           globals.css – design tokens, motion, base styles
  middleware.ts     CSP, origin checks, maintenance mode, admin redirect
firebase/           firestore.rules, firestore.indexes.json   (firebase.json points here)
config/             example infrastructure config (R2 CORS)
scripts/            admin/, migrations/, maintenance/
tests/  e2e/        unit/contract tests (Vitest) and browser tests (Playwright)
```

Rules: `server/*` is never imported from a component. `shared/*` has no Node or browser APIs.
Colours come only from the tokens in `styles/globals.css`.

## Design system
Light **Ivory & Midnight** (ivory page, white cards, midnight-navy actions) and dark
**Obsidian & Champagne** (near-black page, champagne-gold actions). Tokens, status colours and
all motion live in `src/styles/globals.css`. `tests/design-tokens.test.ts` enforces WCAG AA for every
token pair in both themes.

Loading feedback: a global top progress bar tracks every `fetch` (`NetworkProgress`), any
`<button aria-busy>` shows a spinner, routes show a shimmer skeleton, and the admin area shows a
branded loader while the session is verified.

## Authentication flow
1. `POST /api/admin/login-check` – lockout check (5 failures → 15 min).
2. Firebase sign-in (email/password or Google) → TOTP challenge, or first-time authenticator enrolment
   (email must be verified).
3. `POST /api/admin/session` verifies the ID token **and** the TOTP second factor, checks the
   `admins/{uid}` record and role claim, then issues an HttpOnly 8-hour session cookie + CSRF cookie.
4. The browser Firebase user is signed out; the **server cookie is the only credential**. The admin
   layout validates it with `GET /api/admin/session`, which also serves as the idle heartbeat.
5. Every admin API call re-checks cookie, active status, role, idle timeout and CSRF.

There is currently **no email one-time-passcode factor**; the second factor is an authenticator app.


### Promote an existing Firebase user to superadministrator

Use this only for an account you control and have verified in Firebase Authentication. Set `FIREBASE_SERVICE_ACCOUNT_BASE64` and `FIREBASE_PROJECT_ID` in `.env.local`, then run:

```bash
npm run admin:promote-superadmin -- jyH9PefLwNM2apeRf3sF0clVfeu1
```

The script verifies that the Firebase Auth user exists and has a verified email, then synchronizes `admins/{uid}` (`role: superadmin`, `status: active`) with the Firebase custom claim (`role: superadmin`). It preserves unrelated custom claims. After it succeeds, sign out of the portal and sign in again so Firebase issues a fresh ID token. Never commit service-account credentials.
