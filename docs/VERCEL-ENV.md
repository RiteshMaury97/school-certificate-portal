# Environment variables

This guide covers every application variable in `.env.example` and every `process.env` variable read from `src`, `app`, or `scripts`. Vercel-provided values are listed too. Do not put `.env` values, service-account JSON, keys, or passwords in GitHub, logs, screenshots, issue reports, or this document.

In the tables, **Production / Preview / Development** say whether a value is required (`Required`), optional (`Optional`), prohibited (`Unset`), or supplied by the platform (`Platform`). Unless called out otherwise, an unset optional value uses the code's fallback or disables that integration.

## Firebase client

Firebase browser configuration is public by design. `NEXT_PUBLIC_` values are embedded in the client bundle at build time: changing one in Vercel requires a new deployment.

| Name                               | What it does                          | Production / Preview / Development                           | Visibility | Required?                          | How to obtain                                                  |
| ---------------------------------- | ------------------------------------- | ------------------------------------------------------------ | ---------- | ---------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | Firebase Auth browser SDK project key | Required / Required / Optional until Firebase pages are used | Public     | Required in Production and Preview | Firebase console → Project settings → General → Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth redirect domain         | Required / Required / Optional                               | Public     | Required in Production and Preview | Firebase console → Project settings → General → Web app config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | Browser Firebase project identifier   | Required / Required / Optional                               | Public     | Required in Production and Preview | Firebase console → Project settings → General                  |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | Browser Firebase app identifier       | Required / Required / Optional                               | Public     | Required in Production and Preview | Firebase console → Project settings → General → Web app config |

## Firebase Admin

Use a dedicated service account with only the Firebase/Firestore permissions the portal needs. Preview must use a separate staging Firebase project and its own service account.

| Name                              | What it does                                                     | Production / Preview / Development                                                                     | Visibility             | Required?                                                | How to obtain                                                                            |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`             | Server-side Firebase Admin project                               | Required / Required / Optional                                                                         | Server-side identifier | Required in Production and Preview                       | Firebase console → Project settings → General; use the staging project for Preview       |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Preferred Firebase Admin credential: base64 service-account JSON | Required unless the two individual fields are used / Required unless individual fields used / Optional | Secret                 | One credential method required in Production and Preview | Download a service-account JSON securely, then base64 encode it using the commands below |
| `FIREBASE_CLIENT_EMAIL`           | Alternative service-account email                                | Required with private key if base64 JSON is unset / Same / Optional                                    | Server-side identifier | Conditional                                              | From the service-account JSON `client_email`                                             |
| `FIREBASE_PRIVATE_KEY`            | Alternative service-account private key                          | Required with client email if base64 JSON is unset / Same / Optional                                   | Secret                 | Conditional                                              | From the service-account JSON `private_key`; preserve line breaks as `\n` in Vercel      |

## App Check

Production always enforces Firebase App Check. `APP_CHECK_ENFORCE=false` only opts out in local development; it does not disable production enforcement.

| Name                                | What it does                                        | Production / Preview / Development                                             | Visibility          | Required?                          | How to obtain                                                                  |
| ----------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY` | Firebase App Check reCAPTCHA v3 site key            | Required / Required / Optional                                                 | Public              | Required in Production and Preview | Firebase console → App Check → register the web app                            |
| `APP_CHECK_ENFORCE`                 | Development-only override for App Check enforcement | Ignored for enforcement / Ignored for enforcement / Optional `true` or `false` | Server-side setting | Optional                           | Set `false` only for local development without a configured App Check site key |

## Cloudflare R2 (main and backup buckets)

Preview must use its own R2 credentials and certificate bucket. Production backup storage must use a different bucket from `R2_BUCKET`.

| Name                   | What it does                                                 | Production / Preview / Development | Visibility             | Required?                                                              | How to obtain                                                               |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------- | ---------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `R2_ACCOUNT_ID`        | Cloudflare account identifier for the S3-compatible endpoint | Required / Required / Optional     | Server-side identifier | Required in Production and Preview                                     | Cloudflare dashboard → R2 → overview                                        |
| `R2_ACCESS_KEY_ID`     | Main R2 access key                                           | Required / Required / Optional     | Secret                 | Required in Production and Preview                                     | Create a scoped R2 API token; create a different token for Preview          |
| `R2_SECRET_ACCESS_KEY` | Main R2 secret key                                           | Required / Required / Optional     | Secret                 | Required in Production and Preview                                     | Shown once when creating the scoped R2 API token                            |
| `R2_BUCKET`            | Certificate file bucket                                      | Required / Required / Optional     | Server-side setting    | Required in Production and Preview                                     | Create a bucket in Cloudflare R2; use a separate staging bucket for Preview |
| `BACKUP_R2_BUCKET`     | Private encrypted backup bucket                              | Required / Optional / Optional     | Server-side setting    | Required in Production scheduled backups; must differ from `R2_BUCKET` | Create a separate private R2 bucket                                         |

## Turnstile

| Name                             | What it does                             | Production / Preview / Development                               | Visibility | Required?                          | How to obtain                                                                  |
| -------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- | ---------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile browser widget      | Required / Required / Optional (development has a test fallback) | Public     | Required in Production and Preview | Cloudflare dashboard → Turnstile → add a widget for the respective domains     |
| `TURNSTILE_SECRET_KEY`           | Validates Turnstile tokens on the server | Required / Required / Optional                                   | Secret     | Required in Production and Preview | Cloudflare Turnstile widget settings; use Preview/test credentials for Preview |

## HMAC and encryption secrets

Each HMAC secret must be independently generated; never reuse one value for two purposes or across Production and Preview. AES keys must decode from base64 to exactly 32 bytes. These values are all marked **Sensitive** in Vercel.

| Name                                | What it does                                                | Production / Preview / Development                                               | Visibility | Required?                                            | How to obtain                                                            |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `SEARCH_HMAC_SECRET`                | Creates private student search indexes                      | Required / Required / Optional until search is used                              | Secret     | Required in Production and Preview                   | Generate an independent random 32-byte secret using the commands below   |
| `AUDIT_LOG_HMAC_SECRET`             | Hashes requester IPs and protects audit/session data        | Required / Required / Optional                                                   | Secret     | Required in Production and Preview                   | Generate an independent random 32-byte secret                            |
| `CERTIFICATE_ACCESS_TOKEN_SECRET`   | Signs short-lived certificate access tokens                 | Required / Required / Optional                                                   | Secret     | Required in Production and Preview                   | Generate an independent random 32-byte secret                            |
| `CERTIFICATE_NUMBER_HMAC_SECRET`    | Creates private certificate-number lookup hashes            | Required / Required / Optional                                                   | Secret     | Required in Production and Preview                   | Generate an independent random 32-byte secret                            |
| `DISAMBIGUATION_HMAC_SECRET`        | Hashes student disambiguation identifiers                   | Required / Required / Optional                                                   | Secret     | Required in Production and Preview                   | Generate an independent random 32-byte secret                            |
| `DISAMBIGUATION_CHALLENGE_SECRET`   | Signs duplicate-search challenge tokens                     | Required / Required / Optional                                                   | Secret     | Required in Production and Preview                   | Generate an independent random 32-byte secret                            |
| `STUDENT_PII_ENCRYPTION_KEY`        | AES-256-GCM encryption key for DOB/admission identifiers    | Required / Required / Optional until encryption is used                          | Secret     | Required in Production and Preview                   | Generate 32 random bytes and base64-encode them using the commands below |
| `CERTIFICATE_NUMBER_ENCRYPTION_KEY` | AES-256-GCM key for certificate numbers                     | Required / Required / Optional until encryption is used                          | Secret     | Required in Production and Preview                   | Generate a different 32 random bytes and base64-encode them              |
| `EXPORT_ENCRYPTION_KEY`             | AES-256-GCM key for encrypted exports and scheduled backups | Required / Optional / Optional unless export encryption uses the environment key | Secret     | Required in Production because backups are scheduled | Generate a different 32 random bytes and base64-encode them              |
| `NOTIFICATION_OPT_OUT_SECRET`       | Hashes consent-based notification opt-out tokens            | Optional / Optional / Optional until notifications are used                      | Secret     | Optional                                             | Generate an independent random 32-byte secret                            |

Keep encryption keys backed up securely. Losing a key can make the corresponding encrypted data or backups unrecoverable. Key rotation requires a planned data migration; do not replace a live key casually.

## OTP

| Name              | What it does                                  | Production / Preview / Development               | Visibility | Required?                          | How to obtain                                 |
| ----------------- | --------------------------------------------- | ------------------------------------------------ | ---------- | ---------------------------------- | --------------------------------------------- |
| `OTP_HMAC_SECRET` | Hashes administrator email verification codes | Required / Required / Optional until OTP is used | Secret     | Required in Production and Preview | Generate an independent random 32-byte secret |

## Gmail SMTP

| Name                 | What it does                 | Production / Preview / Development                                            | Visibility                  | Required?              | How to obtain                                                                                   |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------------- | --------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `GMAIL_USER`         | SMTP sender mailbox          | Required / Required with a test/staging mailbox / Optional until mail is sent | Secret (account identifier) | Required in Production | Use the school's mail account; use a separate test mailbox in Preview                           |
| `GMAIL_APP_PASSWORD` | SMTP authentication          | Required / Required with the test mailbox / Optional until mail is sent       | Secret                      | Required in Production | Create a Google App Password after enabling 2-Step Verification; never use the account password |
| `GMAIL_FROM_NAME`    | Optional sender display name | Optional / Optional / Optional                                                | Server-side setting         | Optional               | Choose the school display name                                                                  |

## Cron

| Name          | What it does                                                    | Production / Preview / Development                              | Visibility | Required?                                 | How to obtain                                                                                        |
| ------------- | --------------------------------------------------------------- | --------------------------------------------------------------- | ---------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `CRON_SECRET` | Authorizes Vercel cron requests using `Authorization: Bearer …` | Required / Optional unless Preview crons are enabled / Optional | Secret     | Required in Production; at least 32 bytes | Generate an independent random 32-byte secret. Vercel sends the configured value as the Bearer token |

## Upload quotas and operational limits

| Name                           | What it does                                         | Production / Preview / Development                 | Visibility          | Required? | How to obtain                     |
| ------------------------------ | ---------------------------------------------------- | -------------------------------------------------- | ------------------- | --------- | --------------------------------- |
| `UPLOADS_PER_HOUR_LIMIT`       | Per-admin hourly upload count limit                  | Optional (default 60) / Optional / Optional        | Server-side setting | Optional  | Choose a positive integer         |
| `UPLOADS_PER_DAY_LIMIT`        | Per-admin daily upload count limit                   | Optional (default 300) / Optional / Optional       | Server-side setting | Optional  | Choose a positive integer         |
| `UPLOAD_BYTES_PER_DAY_LIMIT`   | Daily uploaded-byte quota and storage budget default | Optional (default 209715200) / Optional / Optional | Server-side setting | Optional  | Choose a positive byte count      |
| `R2_STORAGE_BUDGET_BYTES`      | Dashboard storage alert threshold (default 10 GiB)   | Optional / Optional / Optional                     | Server-side setting | Optional  | Choose a positive byte count      |
| `BREACH_RESPONSE_TARGET_HOURS` | Default target used for breach response deadlines    | Optional (default 72) / Optional / Optional        | Server-side setting | Optional  | Choose a positive number of hours |

## Privacy / DPDP

`NEXT_PUBLIC_` privacy/legal values are public and baked at build time; update them with a redeployment. The retention duration remains available in public settings and defaults to seven years.

| Name                                 | What it does                                            | Production / Preview / Development                                  | Visibility          | Required? | How to obtain                                     |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------- | ------------------- | --------- | ------------------------------------------------- |
| `PRIVACY_POLICY_VERSION`             | Version recorded with data-rights requests and searches | Optional (default `2026-10`) / Optional / Optional                  | Server-side setting | Optional  | Set the current published policy version          |
| `NEXT_PUBLIC_DATA_HOSTING_REGION`    | Region shown in the privacy notice                      | Optional but set to the actual hosting region / Optional / Optional | Public              | Optional  | Set a truthful region label, e.g. `Mumbai, India` |
| `NEXT_PUBLIC_RETENTION_YEARS`        | Fallback retention duration shown in the privacy notice | Optional (default 7) / Optional / Optional                          | Public              | Optional  | Set the approved retention period in years        |
| `NEXT_PUBLIC_PRIVACY_POLICY_VERSION` | Version label shown on the privacy page                 | Optional (default `2026-10`) / Optional / Optional                  | Public              | Optional  | Set the published policy version                  |
| `NEXT_PUBLIC_TERMS_VERSION`          | Version label shown on Terms                            | Optional (default `1.0`) / Optional / Optional                      | Public              | Optional  | Set the published terms version                   |

## Sentry

| Name                     | What it does                 | Production / Preview / Development | Visibility                | Required? | How to obtain                                                   |
| ------------------------ | ---------------------------- | ---------------------------------- | ------------------------- | --------- | --------------------------------------------------------------- |
| `SENTRY_DSN`             | Server-side error reporting  | Optional / Optional / Optional     | Secret/limited-access DSN | Optional  | Sentry project settings → Client Keys (DSN)                     |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser-side error reporting | Optional / Optional / Optional     | Public DSN                | Optional  | Same Sentry project; browser events are scrubbed before sending |

## Plausible analytics

| Name                               | What it does                                           | Production / Preview / Development                              | Visibility | Required? | How to obtain                                                     |
| ---------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- | ---------- | --------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`     | Site domain sent to Plausible for aggregate page views | Optional / Optional / Optional                                  | Public     | Optional  | Configure the domain in the Plausible site settings               |
| `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` | Script endpoint used by the site                       | Optional (defaults to Plausible's script) / Optional / Optional | Public     | Optional  | Use the official script URL or your approved self-hosted endpoint |

## Site URLs

| Name                   | What it does                                                                      | Production / Preview / Development                                                                        | Visibility      | Required?                                     | How to obtain                                                           |
| ---------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `APP_ORIGIN`           | Canonical origin used for request-origin checks, cookies and password reset links | Required; exact live `https://` origin / **Must be unset** / Local origin such as `http://localhost:3000` | Server-side URL | Required in Production; prohibited in Preview | Copy the exact production domain origin, without path or trailing slash |
| `SITE_URL`             | Canonical URL used in sitemap, robots, mail and backup links                      | Required; exact same live `https://` origin as `APP_ORIGIN` / Optional / Local origin or optional         | Server-side URL | Required in Production                        | Copy the exact canonical production domain origin                       |
| `NEXT_PUBLIC_SITE_URL` | Public base URL for email links where configured                                  | Optional; if set match the live URL / Usually unset so Vercel URL can be used / Optional                  | Public          | Optional                                      | Use an HTTPS URL; redeploy after changes                                |

Production validation requires `APP_ORIGIN` and `SITE_URL` to be HTTPS origins and to match. Preview validation rejects any `APP_ORIGIN`; preview request handling then accepts the preview URL as its own origin.

## ClamAV

| Name                | What it does                                                | Production / Preview / Development                                                               | Visibility                  | Required?                                     | How to obtain                                                                        |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `CLAMD_HOST`        | Private hostname/address of the school-hosted ClamAV daemon | Required / Required if Preview accepts uploads / Optional (default local setup uses `127.0.0.1`) | Server-side network setting | Required in Production                        | Use the private host reachable through the configured private network/VPN/TLS tunnel |
| `CLAMD_PORT`        | Clamd TCP port                                              | Optional (default 3310) / Optional / Optional                                                    | Server-side setting         | Optional                                      | Default is `3310`                                                                    |
| `CLAMD_TIMEOUT_MS`  | Scanner connection/reply timeout                            | Optional (default 15000 ms) / Optional / Optional                                                | Server-side setting         | Optional                                      | Choose a positive timeout in milliseconds                                            |
| `MALWARE_SCAN_MODE` | Upload scan policy                                          | Must be `required` / `required` for Preview uploads / `required` or `off`                        | Server-side setting         | Required in Production; default is `required` | Set to `required`; `off` is rejected in production                                   |

## Restore and seed scripts

These are operator-run script inputs, not Vercel runtime settings. Never point restore tests at Production.

| Name                         | What it does                                           | Production / Preview / Development                                   | Visibility             | Required?                      | How to obtain                          |
| ---------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------- | ------------------------------ | -------------------------------------- |
| `RESTORE_STAGING_PROJECT_ID` | Safety target project for restore verification         | Never use Production / Required when running restore test / Optional | Server-side identifier | Required only for restore test | Firebase staging project ID            |
| `RESTORE_TEST_LOG`           | Optional local restore-test report output path         | Not used / Optional / Optional                                       | Local path             | Optional                       | Choose a local file path               |
| `SEED_SESSIONS`              | Sessions created by the Firestore seed script          | Not used / Not used / Optional (default `2026-27`)                   | Local script setting   | Optional                       | Comma-separated academic sessions      |
| `SEED_CERTIFICATE_TYPES`     | Certificate types created by the Firestore seed script | Not used / Not used / Optional                                       | Local script setting   | Optional                       | Comma-separated certificate type names |

## Vercel/Next.js supplied values

Do not manually create these in `.env.example`. They are read by source code or supplied by the platform/runtime.

| Name           | What it does                                                                                                             | Production / Preview / Development               | Visibility              | Required?          | How to obtain                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ----------------------- | ------------------ | ----------------------------------------------------------- |
| `NODE_ENV`     | Next.js runtime/build mode                                                                                               | `production` / `production` / `development`      | Server/runtime metadata | Platform           | Set by Next.js                                              |
| `NEXT_PHASE`   | Identifies Next.js build-time phases so runtime validation does not treat a local build as a deployed production runtime | Production build / Preview build / Development   | Server/runtime metadata | Platform           | Set by Next.js                                              |
| `VERCEL_ENV`   | Identifies Production, Preview, or Development deployment                                                                | `production` / `preview` / Usually unset locally | Server/runtime metadata | Platform on Vercel | Set by Vercel                                               |
| `VERCEL_URL`   | Current deployment hostname used for fallback links                                                                      | Deployment hostname / Preview hostname / Unset   | Public hostname         | Platform on Vercel | Set by Vercel; code adds `https://` when constructing links |
| `NEXT_RUNTIME` | Identifies the Next.js server runtime for instrumentation                                                                | Platform value / Platform value / Platform value | Server/runtime metadata | Platform           | Set by Next.js                                              |

## Generate keys and encode credentials

Generate a new value for every HMAC, OTP, cron, and opt-out secret. The commands below output 32 random bytes encoded as base64; use the output text directly for text secrets. For AES keys, the output is also the required base64 encoding of exactly 32 random bytes.

**macOS/Linux, 32 random bytes as base64:**

```sh
openssl rand -base64 32
```

**Windows PowerShell, 32 random bytes as base64:**

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

To base64-encode the Firebase service-account JSON file (do not paste its JSON contents into a terminal command or commit the file):

**macOS/Linux:**

```sh
base64 < service-account.json | tr -d '\n'
```

**Windows PowerShell:**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

Set the output in the appropriate Vercel environment. AES keys must be generated separately from each other and from every HMAC secret.

## Production and Preview setup

- `NEXT_PUBLIC_` settings are baked into the build. Any change requires a redeployment.
- Production: set `APP_ORIGIN` and `SITE_URL` to the exact same HTTPS origin for the live domain, for example `https://school.example` (no path or trailing slash).
- Preview: leave `APP_ORIGIN` unset. Configure a separate staging Firebase project/service account, separate R2 credentials and bucket, and test-only Gmail settings. Do not copy Production secrets into Preview. The environment checker requires Preview values to be present and enforces the `APP_ORIGIN` rule; Vercel does not expose Production secret values to Preview, so reviewers must ensure Vercel variables are scoped to Preview and use staging resources.
- Production: `CRON_SECRET` is required and must be at least 32 bytes. Vercel sends the configured value as the cron request's `Authorization: Bearer <CRON_SECRET>` header.
- Mark every secret value **Sensitive** in Vercel. Never log, echo, or include any secret value in an error message; diagnostics should report variable names only.
- Vercel's Hobby plan uses once-daily cron schedules. Current schedules are `0 4 * * *` UTC (approximately 09:30 IST).

## Check configuration

Run `npm run check:env`. It loads local Next.js environment files and applies the same Zod validation used by server secret readers. In Production it fails with missing/invalid variable names only; it never prints values. Preview checks require separate staging service settings to be configured and reject `APP_ORIGIN`.
