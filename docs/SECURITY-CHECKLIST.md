# Security checklist

Operational record for release reviews. Replace the `school.example` contact and URL placeholders in `public/.well-known/security.txt` before launch.

## IP and location controls

- [ ] Confirm `APP_ORIGIN` and the production edge proxy configuration. The application reads client IP from `x-vercel-forwarded-for` or `x-real-ip`; Cloudflare headers are trusted only when `TRUST_CLOUDFLARE_PROXY=true`.
- [ ] Confirm country and city headers come from the trusted edge. Admin policy defaults to allowed country `IN`; superadmins can set countries and IP/CIDR exceptions under site settings.
- [ ] Keep location enforcement on `block` in production. Review `admin.location.blocked` events; logs retain country and a keyed IP hash rather than a raw IP.
- [ ] Verify a blocked admin cannot sign in or keep a session, and an allowed IP/CIDR or temporary exception works as intended.

## Upload controls

- [ ] Certificate files: 4 MB maximum; PDF, JPG or PNG only; extension, declared MIME type, and magic bytes must agree.
- [ ] PDFs are parsed, encrypted documents are rejected, and page count is 1–10. Images are limited to 40 million pixels.
- [ ] Student imports are limited to 2 MB and 500 data rows. Mapped bulk intake accepts at most 20 files, each within the 4 MB file limit.
- [ ] Verify per-admin quotas: 60 uploads/hour, 300/day, and 200 MB/day. Set `UPLOADS_PER_HOUR_LIMIT`, `UPLOADS_PER_DAY_LIMIT`, and `UPLOAD_BYTES_PER_DAY_LIMIT` to override defaults.
- [ ] Confirm oversized `Content-Length` returns 413 before body parsing, real sizes are checked, and quota excess returns 429.
- [ ] Confirm R2 storage budget and 80% superadmin notification via `R2_STORAGE_BUDGET_BYTES`.

## Pre-launch penetration test

- [ ] Test IDOR and role bypass across student, certificate, report, export, and admin routes; verify Firestore client access remains denied.
- [ ] Test CSRF, origin checks, App Check, session expiry/revocation, OTP replay, brute force, and rate-limit boundaries.
- [ ] Test Turnstile bypass and reference-ID enumeration on report submission/status; verify status responses contain no personal data.
- [ ] Test emergency lockdown on lookup, verify, print, bundle, and download endpoints; confirm the admin console and sign-in remain available and audit events record both transitions.
- [ ] Test file spoofing, malformed/encrypted/oversized PDFs, PDF page limits, decompression bombs, bulk row/file caps, and cross-record duplicate overrides.
- [ ] Test R2 object access, replacement/deletion handling, quota resets, budget alerts, backup restore, and the daily security email.
- [ ] Scan the repository and build artifacts for secrets and committed logs; review `npm audit` and Dependabot alerts.
- [ ] Confirm `/.well-known/security.txt` contact, canonical URL, and policy URL are real and monitored.
