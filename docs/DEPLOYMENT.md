# Deployment and release routine

## CI and Vercel branch policy

`.github/workflows/ci.yml` runs for every pull request and every push to `main`: `npm install`, lint, typecheck, unit tests, production build, `npm audit`, and Gitleaks secret scanning. It uploads no artifacts or reports. `.github/dependabot.yml` checks npm packages and GitHub Actions weekly.

In **Vercel → Project → Settings → Git**, set **Production Branch** to `main`. Only commits on `main` should receive the Production deployment and production domain. Pull requests should produce protected Preview deployments. Require the CI workflow to pass before merging (GitHub repository **Settings → Branches → Branch protection rules** or **Rulesets**; require the `CI / Lint, typecheck, test, build, audit, secrets` check). Do not merge when checks fail.

## Release steps

1. Open a pull request into `main`. Wait for CI to pass and Vercel to finish the protected Preview deployment.
2. Review the Preview pages, certificate search, admin login, and upload flow using staging-only Firebase, R2, SMTP, Turnstile, and ClamAV settings.
3. Run the smoke test against the Preview URL after deployment:

   ```sh
   npm run smoke -- https://<preview-host>.vercel.app --environment=preview
   ```

   This confirms routes, headers, origin rejection, noindex, and unauthorized cron handling. Positive cron checks execute real backup, email, and malware-rescan handlers, so run them only against a safe staging deployment with test resources:

   ```sh
   # macOS/Linux: export CRON_SECRET using the staging value from your secret manager first.
   npm run smoke -- https://<preview-host>.vercel.app --environment=preview --run-crons
   ```

   The script reads `CRON_SECRET` from its process environment and never prints it. Do not run `--run-crons` against Production as a routine check; it can send mail, write a backup, and update records.

4. Merge the reviewed pull request to `main`. Vercel automatically builds and deploys the `main` commit to Production. Do not promote a Preview deployment from a non-`main` branch to the Production domain.
5. Once the Production deployment is Ready, run the non-mutating smoke checks against the live URL:

   ```sh
   npm run smoke -- https://school.example --environment=production
   ```

   The script checks HSTS in Production. Positive cron handlers are covered on safe staging; their 401 protection is checked on each smoke run.

6. If a Production deployment was deliberately held for manual promotion, review it and select **Promote to Production** only if it was built from `main` and passed Preview and CI checks. With normal automatic Production deployments from `main`, no separate promotion is needed.

The application has a Vercel `/api/health` endpoint with version, environment, and boolean-only required-environment presence. It contains no secret values and makes no database writes.

## Chunk 4: Domain change runbook

When the production hostname or school email domain changes, update the existing deployment configuration and provider allowlists, then redeploy. No application source edit is required.

1. In Vercel **Settings → Environment Variables**, update Production `SITE_URL` to the new HTTPS portal origin. Keep deprecated `APP_ORIGIN` equal to it only while legacy configuration still needs it. Add the old origin temporarily to `ADDITIONAL_ALLOWED_ORIGINS` when both domains must accept requests. The school’s external official website is configured separately as `OFFICIAL_WEBSITE` in `config/school.ts`; contact, grievance, and security addresses remain in `siteSettings/main`. `SECURITY_CONTACT_EMAIL` is an optional fallback for security.txt. Update `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` when Plausible is enabled. `GMAIL_USER` is the independent outbound Gmail sender; change it only if the sender mailbox is moving too. Keep Preview variables scoped to staging. If the Cloudflare cron Worker is enabled, update its `SITE_URL` Worker variable to the new origin as well.
2. Add the new hostname to the Firebase Authentication authorized domains. Add the hostname to the Firebase App Check allowed domains for every enabled provider, including reCAPTCHA Enterprise or reCAPTCHA v3 as applicable.
3. Add the hostname to the Cloudflare Turnstile widget's allowed hostnames. If replacing site keys, update `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the matching Vercel environment.
4. In Google Cloud Console, update the OAuth client authorized JavaScript origins and redirect URIs for the website integrations. Preserve the Firebase Auth handler URI configured for Google sign-in.
5. Add the domain in Vercel **Settings → Domains**, configure the requested DNS records, and verify HTTPS and the canonical/www redirect.
6. Add or verify the hostname in the Plausible site configuration. In Sentry, check project allowed domains/client security settings and update any domain filters or alert rules that include the old hostname.
7. Redeploy Production so the updated `NEXT_PUBLIC_` values are rebuilt. Confirm `SITE_URL` is valid and remove `APP_ORIGIN` once the alias is no longer needed. Run `npm run check:env` and `npm run smoke -- https://school.example --environment=production`. Verify sign-in, contact/security links, analytics, and error reporting on the new hostname before retiring the old domain; remove the old origin from `ADDITIONAL_ALLOWED_ORIGINS` when migration is complete.

## Roll back

If Production has a regression, open **Vercel → Project → Deployments**, select the last known-good Production deployment, and choose **Instant Rollback**. Confirm the live domain serves that deployment, then run the Production smoke command above. Follow with a fix in a pull request and rerun CI before merging.

Instant Rollback changes the deployed code, but it does not undo Firestore/R2 writes or migrations. It also does not automatically update active Cron Job definitions; check **Settings → Cron Jobs** after a rollback and disable or update any route that no longer matches the rolled-back code. Use the database and backup recovery procedure for data changes; do not assume a code rollback restores data.

## Rotate a secret

1. Identify the consumers and invalidation effects below. Prepare dependent services first (for example, update the clamd tunnel credentials/firewall or replace Gmail credentials).
2. Generate a new independent value in the secret manager. In **Vercel → Settings → Environment Variables**, replace the value in the correct scope (Production, Preview, or Development), keep it marked **Sensitive**, and never paste it in a log or ticket.
3. Redeploy the affected environment. Environment changes do not modify existing deployments. For `NEXT_PUBLIC_` values, rebuild/redeploy because they are baked into the client bundle.
4. Verify `/api/health`, admin login, relevant mail/cron/scanner behavior, and the smoke checks. Revoke the old credential at its issuing provider after the new deployment is confirmed.

| Secret/configuration                                                                  | What rotation affects                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CRON_SECRET`                                                                         | Old cron Bearer tokens stop working immediately after the new deployment; Vercel uses the new configured value for later invocations.                                                                                                                                                                              |
| `AUDIT_LOG_HMAC_SECRET`                                                               | Invalidates HMAC-derived admin session/reauthentication and location-check tokens; administrators may need to sign in again. Historic audit entries remain stored, but any integrity verification tied to this key may no longer validate without retaining the old key under a controlled verification procedure. |
| `CERTIFICATE_ACCESS_TOKEN_SECRET`                                                     | Invalidates existing signed certificate access links/tokens. Send fresh links when needed.                                                                                                                                                                                                                         |
| `OTP_HMAC_SECRET`                                                                     | Invalidates outstanding administrator email-code challenges; users must request a new code.                                                                                                                                                                                                                        |
| `SEARCH_HMAC_SECRET`, `DISAMBIGUATION_HMAC_SECRET`, `DISAMBIGUATION_CHALLENGE_SECRET` | Invalidates outstanding search/disambiguation tokens and changes derived lookup keys. Follow a planned reindex/migration if persisted records depend on a derived HMAC key; do not rotate without checking migration guidance.                                                                                     |
| `STUDENT_PII_ENCRYPTION_KEY`, `CERTIFICATE_NUMBER_ENCRYPTION_KEY`                     | Existing encrypted data cannot be decrypted with only the new key. Perform the documented key migration with both old and new keys available before replacing the live key; preserve a protected recovery copy.                                                                                                    |
| `EXPORT_ENCRYPTION_KEY`                                                               | New backups/exports use the new key; old encrypted backups require the old key to restore. Retain old keys securely for the backup retention period and label them by version outside the application.                                                                                                             |
| `R2_SECRET_ACCESS_KEY`                                                                | Replaces R2 API authentication. Update/verify bucket-scoped credentials and revoke the old token after deployment.                                                                                                                                                                                                 |
| `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`   | Replaces Firebase Admin credentials. Create/validate the new service account first, deploy it, then revoke the old key. Firebase client sessions are not deliberately revoked by this rotation.                                                                                                                    |
| `GMAIL_APP_PASSWORD`                                                                  | Stops mail sent with the previous app password; update and test SMTP before revoking the old password.                                                                                                                                                                                                             |
| `TURNSTILE_SECRET_KEY`                                                                | Old Turnstile challenge tokens can no longer validate; users may need to refresh/retry a form during rollout.                                                                                                                                                                                                      |
| `NOTIFICATION_OPT_OUT_SECRET`                                                         | Existing notification opt-out links derived from the old key may stop validating. Plan an overlap/migration if outstanding links need to remain usable.                                                                                                                                                            |

## Vercel plan limits affecting this app

Check the current plan and project settings before launch; Vercel can update limits. These values were checked against the [Functions limits](https://vercel.com/docs/functions/limitations), [Hobby plan](https://vercel.com/docs/plans/hobby), [Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), and [runtime-log retention](https://vercel.com/docs/logs/runtime).

- **Request/response body size:** Vercel Functions limit a complete request or response body to **4.5 MB**. This app caps each certificate file at **4 MB** and submits bulk-upload files one per HTTP request (the app's extra multipart/form-data overhead is limited). Do not increase the file cap above the platform body limit without changing the upload architecture.
- **Function duration:** `vercel.json` explicitly sets the longer-running upload, PDF/export, backup, and cron functions to **60 seconds**. This is within the Hobby maximum when Fluid Compute is off (Hobby's non-Fluid maximum is 60 seconds). Fluid Compute can expose a different maximum; these routes remain capped by their committed `maxDuration: 60` until that setting is changed and redeployed. A timed-out function returns an error and may have completed some external writes, so make operations idempotent and inspect records before retrying.
- **Cron:** Hobby cron jobs run at most **once per day**, and Vercel may invoke a job anywhere in the scheduled hour (up to **59 minutes** after the scheduled minute). Current schedules are `0 4 * * *` UTC, about **09:30 IST**. Cron work must tolerate delayed invocation and retries/manual reruns.
- **Runtime logs:** Hobby runtime logs are retained for **one hour**. Do not rely on them for incident history. Use the application's persistent audit logs for security/admin events and Sentry for scrubbed error reporting; neither should contain secret values or unnecessary personal data.
