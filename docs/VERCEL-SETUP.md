# Manual deployment setup checklist

This checklist covers dashboard work that cannot be committed as code. Complete it in order. Keep credentials in the relevant provider dashboard and Vercel environment settings; never paste them into tickets or logs.

## 1. Vercel project

- [ ] Confirm the account and repository are eligible for Hobby before importing. Hobby is for personal, non-commercial use. Vercel does not allow a Hobby project to deploy from a private GitHub organization repository; use a personal-account repository or move the Vercel project to Pro. Check the current [Hobby plan](https://vercel.com/docs/plans/hobby), [Git integration rules](https://vercel.com/docs/git#deploying-private-git-repositories), and [Terms of Service](https://vercel.com/legal/terms) for the school portal's actual use.
- [ ] In Vercel, choose **Add New → Project**, connect GitHub, and import this repository.
- [ ] Set **Production Branch** to `main`.
- [ ] Set **Framework Preset** to `Next.js`.
- [ ] Set **Node.js Version** to `20.x` or newer (the repository requires Node `>=20.9.0`; use the currently supported 20.x runtime).
- [ ] Set the function **Region** to `Mumbai, India (bom1)`.
- [ ] Keep the repository's build settings: Install `npm install`; Build `next build` (also specified in `vercel.json`).
- [ ] Add environment values in **Settings → Environment Variables**, scoped deliberately to Production, Preview, or Development. Use [VERCEL-ENV.md](./VERCEL-ENV.md) as the complete name-by-name source. Production must use the live HTTPS origin, production Firebase project/service-account, production private R2 bucket, backup bucket, and `MALWARE_SCAN_MODE=required`. Preview must use a separate staging Firebase project, R2 bucket/credentials, and test Gmail account; leave `APP_ORIGIN` unset and never copy Production secrets. Mark every secret **Sensitive**. `` values are embedded at build time, so changing them requires a redeployment.
- [ ] Under **Settings → Deployment Protection**, enable **Vercel Authentication** for Preview deployments. Add the small set of school reviewers who need preview access. Do not make preview deployments public just to simplify Google login.
- [ ] Under project/account **Usage**, set any available usage notifications early and review usage weekly. Hobby has no paid spend cap/spend-management feature; it is a free tier with included quotas, and exceeding some limits can suspend usage until the quota window resets. If budget alerts, team controls, or commercial school use are needed, use Pro and configure a spend limit/alert there. Do not treat an alert as a hard spending cap.
- [ ] After the first Production deployment, verify the deployment is from `main`, functions are in `bom1`, and `/api/health` returns the expected safe health response.

The matching Firestore database must be created in `asia-south1` (Mumbai) to keep it near `bom1`. **Firestore location cannot be changed after creation**, so check this before creating the Production database.

## 2. Domain and DNS

- [ ] For the current production portal, set `SITE_URL` to `https://tc.sischool.in` (origin only, no trailing slash). If the `school-certificate-portal.vercel.app` hostname should remain usable, add `https://school-certificate-portal.vercel.app` to `ADDITIONAL_ALLOWED_ORIGINS`.
- [ ] In **Project → Settings → Domains**, add the apex domain, for example `school.example`, and `www.school.example`.
- [ ] Copy the DNS records Vercel shows for this exact domain. Commonly the apex is an `A` record to Vercel's displayed target and `www` is a `CNAME`, but use the values Vercel currently provides. Remove conflicting records at the DNS provider.
- [ ] Wait for Vercel to verify the records and issue HTTPS certificates. Test both `https://school.example` and `https://www.school.example` after DNS propagation.
- [ ] Configure a single redirect from `www.school.example` to `school.example` (apex) in Vercel's domain settings. Verify it is a permanent HTTPS redirect and does not loop.
- [ ] Set `SITE_URL` in Production to the exact canonical HTTPS origin, e.g. `https://school.example` (no path, query, or trailing slash). `APP_ORIGIN` is a deprecated alias and may be removed after migration.
- [ ] **HSTS caution:** Production sends `Strict-Transport-Security` with `includeSubDomains` and `preload`. Keep that policy only after every subdomain is HTTPS-capable and stays that way. Do not submit the domain to browser preload lists until all subdomains have been checked; preload removal is slow and can strand HTTP-only subdomains.

## 3. Firebase

Use separate Firebase projects for Production and Preview/staging.

- [ ] In the Production Firebase Console, open **Authentication → Settings → Authorized domains** and add the exact hostnames:
  - `tc.sischool.in`
  - `school.example`
  - `www.school.example`
  - The production Vercel project hostname, e.g. `school-certificate-portal.vercel.app`
- [ ] Add the staging domain and the exact Vercel Preview hostnames to the staging Firebase project's authorized domains, not Production. Firebase authorized domains are hostnames, without scheme or path. Preview deployments have unique generated hostnames; add the stable Preview alias where available, or use email/password in previews and avoid Google sign-in there.
- [ ] In **Authentication → Sign-in method**, enable **Google** and **Email/Password**. Use school-controlled administrators for Google access and check the support email/provider configuration.
- [ ] In **App Check**, register the same Production hosts for the web app's **reCAPTCHA v3** provider: `tc.sischool.in`, `school.example`, `www.school.example`, and the production `*.vercel.app` project hostname. Register staging/Preview hosts only in the staging project. After validation, enforce App Check for the applicable Firebase products.
- [ ] App Check debug tokens are for local/staging testing only. Register debug tokens only in the staging project, keep them out of source control, and never enable or register them in Production.
- [ ] From the project root, review `firebase/firestore.rules`; it denies all client reads and writes (Admin SDK server handlers bypass Firestore rules). Deploy with `npx firebase deploy --only firestore:rules --project <production-project-id>` after selecting/verifying the Production project. Confirm the same deny-all policy is deployed to staging with its project ID.
- [ ] Create Production Firestore in `asia-south1` (Mumbai), matching Vercel `bom1`. Confirm the location before clicking create; it cannot be changed later.

### Google sign-in choice: popup only

This project uses `signInWithPopup()` for Google administrator sign-in on desktop and mobile. It does **not** use `signInWithRedirect()`, because browsers that block third-party storage can break redirect sign-in when Firebase `authDomain` differs from the site domain. Firebase documents popup sign-in as one supported option for apps hosted outside Firebase Hosting. The app keeps the normal Firebase project `authDomain`; **do not add Firebase auth proxy rewrites to `vercel.json`**. If a custom OAuth client ID is configured, verify the Firebase project's Google provider and OAuth client list the Firebase handler URI `https://<firebase-auth-domain>/__/auth/handler`. If popup sign-in is blocked by a browser/device, ask the user to allow popups or use the email/password flow; do not silently switch to redirect.

See Firebase's current [redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices) and [Google sign-in documentation](https://firebase.google.com/docs/auth/web/google-signin).

## 4. Cloudflare Turnstile and R2

- [ ] In **Cloudflare → Turnstile**, create one Production widget allowing `tc.sischool.in`, `school.example`, `www.school.example`, and `school-certificate-portal.vercel.app`. Set `TURNSTILE_SITE_KEY` to its site key and `TURNSTILE_SECRET_KEY` to its secret in Production only.
- [ ] Create a separate staging Turnstile widget for the staging hostname and any stable Preview hostname. Put its site and secret keys in Preview only.
- [ ] Create the main Production R2 bucket and a **different** backup R2 bucket. Keep both private; do not enable public bucket access or public custom domains.
- [ ] Create separate staging R2 bucket(s) and credentials. Configure `R2_BUCKET` to the upload bucket and `BACKUP_R2_BUCKET` to the separate backup bucket in Production; use the staging bucket in Preview.
- [ ] Create a Cloudflare API token restricted to the required R2 object read/write/list permissions and the specific buckets used by this app. Do not use a Global API Key. Enter `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` only as Vercel secrets for the appropriate environment.
- [ ] Set a lifecycle policy on the backup bucket according to the school's approved backup retention and recovery objectives. Test restore before relying on expiration.
- [ ] Enable object versioning if the bucket/account features and application workflow support it; document that versioning is not a backup by itself and increases storage use. Verify lifecycle rules also clean up old noncurrent versions.

## 5. Gmail SMTP

- [ ] Use a dedicated, school-controlled Google mailbox. Enable Google 2-Step Verification, then create an **App Password** for this application; use the App Password, never the account password.
- [ ] Set `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and optional `GMAIL_FROM_NAME` (e.g. `School Certificate Portal`) in Production. Use a separate test mailbox and sender name in Preview.
- [ ] Gmail SMTP sending is limited to **500 recipients per day** for regular Gmail accounts (Google Workspace limits may differ). The application has its own lower operational quota; monitor provider limits and use an approved transactional mail service if the volume grows.

## 6. Optional monitoring and analytics

- [ ] **Sentry (optional):** create a project for the app and set `SENTRY_DSN` (server) and, if browser reporting is desired, `BROWSER_SENTRY_DSN` (public) in the intended environments. Restrict/allowlist the Production and staging domains where Sentry supports it; keep alerts access limited. This app scrubs user and request data, but do not add personal data, form values, certificate data, search text, or identity to events/tags.
- [ ] **Plausible (optional):** create a site for `school.example`, set `PLAUSIBLE_DOMAIN=school.example` and `PLAUSIBLE_SCRIPT_URL=https://plausible.io/js/script.js`. Configure only aggregate page views. Do not add custom events, form values, search queries, certificate/student identifiers, or other personal data. If using a self-hosted Plausible endpoint, use its approved HTTPS script URL.

## 7. ClamAV scanner host

ClamAV cannot run inside a Vercel Function: the function must connect to a separately hosted `clamd` service controlled by the school. Host the official `clamav/clamav` container on a small school-controlled VPS or private container host, with persistent signature storage and FreshClam updates. Allow only the Vercel application's outbound path (or a private connector/VPN/TLS tunnel) to reach it.

- [ ] Set Production `CLAMD_HOST` to the private hostname/address reachable from the Vercel runtime and `CLAMD_PORT=3310` (or the port used on the private tunnel). Set `MALWARE_SCAN_MODE=required`.
- [ ] Set staging `CLAMD_HOST` to a staging-reachable scanner or explicitly keep uploads disabled there; never point Preview at an unrestricted Production scanner.
- [ ] Port 3310 is plaintext clamd protocol. **Never expose it on a public interface.** Restrict it to a private network, VPN, or TLS tunnel, and firewall all other sources. Confirm the connection and `/api/admin/malware/health` status before enabling uploads.
- [ ] Follow [MALWARE-SCANNING.md](./MALWARE-SCANNING.md) for RAM, update, health alert, rescan, and incident procedures.

## Final go-live review

- [ ] Production deployment is from `main`; Preview protection is on.
- [ ] `SITE_URL` is the apex HTTPS origin; DNS, HTTPS, and www redirect work.
- [ ] Production Firebase domains/providers/App Check are correct; Firestore location and deny-all rules are verified.
- [ ] Production and Preview secrets/resources are separate; all secrets are marked Sensitive.
- [ ] Private main and backup buckets, Gmail sender, Turnstile widget and ClamAV connectivity are verified.
- [ ] Optional analytics/monitoring contain no personal data.
- [ ] Review Vercel usage and provider quotas after the first day, then on a regular schedule.
