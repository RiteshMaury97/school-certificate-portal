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

1. Firebase console → Project settings → Service accounts → _Generate new private key_.
2. Encode it: `base64 -w0 service-account.json` → put the result in `FIREBASE_SERVICE_ACCOUNT_BASE64`.
3. **Delete the JSON file.** Never commit it. `.gitignore` blocks `service-account*.json`.

If the session picker shows _"Sessions could not be loaded"_ or admin login fails, check the
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

### Firebase Authentication setup and diagnostics

Follow [`docs/FIREBASE-AUTH-SETUP.md`](docs/FIREBASE-AUTH-SETUP.md) to enable Email/Password,
Google sign-in, Gmail SMTP email-code delivery, authorized domains, and localhost App Check debugging.

Administrator sign-in uses Firebase Authentication for the first step and a server-verified six-digit email code for the second step. Configure `GMAIL_USER` and `GMAIL_APP_PASSWORD` (a Google App Password; the sender mailbox must have 2-Step Verification enabled) before testing administrator sign-in.

### First administrator

```bash
npm run admin:create-superadmin -- someone@school.example
```

The user must already exist in Firebase Authentication with a verified email. On each sign-in, they receive a six-digit code through Gmail SMTP.

## Project layout

```
src/
  app/              Next.js routes only (pages, layouts, API route handlers)
    (public pages)  page.tsx files: thin, they export metadata and render a feature view
    admin/          login and (console)/ – one shared console layout for all sections
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
2. Firebase sign-in (email/password or Google) → Gmail-delivered six-digit code
   (email must be verified).
3. `POST /api/admin/session` verifies the ID token **and** the one-time email proof, checks the
   `admins/{uid}` record and role claim, then issues an HttpOnly 8-hour session cookie + CSRF cookie.
4. The browser Firebase user is signed out; the **server cookie is the only credential**. The admin
   layout validates it with `GET /api/admin/session`, which also serves as the idle heartbeat.
5. Every admin API call re-checks cookie, active status, role, idle timeout and CSRF.

The email code is generated and verified by the application server; no paid Firebase authentication feature is required.

### Student record retention

The configured retention period is measured from the end of the student's passing session. The
portal does not run an automatic retention review or delete student records on a schedule. Records
are deleted on an approved erasure request or after an authorized manual review confirms they are
no longer required, subject to legal and school recordkeeping obligations.

### Promote an existing Firebase user to superadministrator

Use this only for an account you control and have verified in Firebase Authentication. Set `FIREBASE_SERVICE_ACCOUNT_BASE64` and `FIREBASE_PROJECT_ID` in `.env.local`, then run:

```bash
npm run admin:promote-superadmin -- jyH9PefLwNM2apeRf3sF0clVfeu1
```

The script verifies that the Firebase Auth user exists and has a verified email, then synchronizes `admins/{uid}` (`role: superadmin`, `status: active`) with the Firebase custom claim (`role: superadmin`). It preserves unrelated custom claims. After it succeeds, sign out of the portal and sign in again so Firebase issues a fresh ID token. Never commit service-account credentials.

## Administrator email verification codes

Administrator sign-in uses Firebase Authentication for the first factor and a custom six-digit code sent through the configured Gmail SMTP account for the second factor. Configure `OTP_HMAC_SECRET` with at least 32 random bytes; it must be separate from `AUDIT_LOG_HMAC_SECRET`. The code is stored only as an HMAC in the server-only `adminOtpChallenges` collection, expires after 10 minutes, and allows at most five incorrect attempts. The verified challenge is consumed when the server creates a session and is valid for that step for five minutes. No client Firestore access is permitted to this collection.

All outgoing mail uses `src/server/mailer.ts` with Gmail SMTP only. Configure `GMAIL_USER`, `GMAIL_APP_PASSWORD` (Google App Password; 2-Step Verification required), and optionally `GMAIL_FROM_NAME`. A daily `abuseCounters` quota caps recipients at 500.

### Gmail sender security and quota

Follow [`docs/FIREBASE-AUTH-SETUP.md`](docs/FIREBASE-AUTH-SETUP.md#2-gmail-smtp-and-app-password) to enable Google 2-Step Verification and create a Google App Password. Administrator mailboxes should enforce 2-Step Verification. Configure `GMAIL_USER`, `GMAIL_APP_PASSWORD`, optional `GMAIL_FROM_NAME`, and the independent `OTP_HMAC_SECRET` in `.env.local`; never expose these values to browser code. The mailer limits the application to 500 recipients per UTC day and warns at 400. Gmail may enforce a lower account-specific limit.

### Troubleshooting administrator email-code delivery

If `POST /api/admin/otp/send` fails, inspect the server terminal for the
`[admin/otp/send]` diagnostic. Invalid or expired Firebase ID tokens return
HTTP 401; mail, Firestore, or missing-secret configuration failures return
HTTP 503 instead of being misreported as authentication failures.

Ensure the server environment contains all of these values:

- `AUDIT_LOG_HMAC_SECRET` — at least 32 random bytes.
- `OTP_HMAC_SECRET` — at least 32 random bytes and separate from the audit secret.
- `GMAIL_USER` — the Gmail mailbox used to send portal mail.
- `GMAIL_APP_PASSWORD` — a Google App Password for that mailbox (not the normal
  Google account password; 2-Step Verification must be enabled).
- `FIREBASE_SERVICE_ACCOUNT_BASE64` (or the documented Firebase Admin credential
  alternatives) with access to the project's Firestore database.

Generate separate secrets in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Run it twice and assign one result to each HMAC secret. Restart the Next.js
server after changing environment variables. Never commit real secrets.
