# Security checklist

## Current controls to verify

- [ ] Keep administrator IP and location controls enabled. Production defaults to blocking countries outside India; configure trusted administrator CIDRs and temporary, audited exceptions in the admin location policy. Never trust client supplied IP headers outside the configured trusted proxy chain.
- [ ] Keep location enforcement in `block` mode for production. Confirm country-change detection revokes the session and emits an audit event.
- [ ] Certificate files: PDF/JPG/PNG only, matching extension, declared MIME type, and magic bytes; maximum 4 MB; PDFs must be unencrypted and have 1–10 parsed pages; images are limited to 40 megapixels.
- [ ] Bulk mapping CSV: maximum 2 MB and 500 rows; maximum 20 certificate files per batch.
- [ ] Enforce per-admin upload quotas: 60 per hour, 300 per day, and 200 MB per day by default. Review `UPLOADS_PER_HOUR_LIMIT`, `UPLOADS_PER_DAY_LIMIT`, and `UPLOAD_BYTES_PER_DAY_LIMIT` before changing them.
- [ ] Check R2 storage usage and budget. The default alert budget is 10 GB; configure `R2_STORAGE_BUDGET_BYTES` to the operational budget and confirm superadmin email delivery.
- [ ] Keep `*.log`, `firebase-debug.log`, and `*.tsbuildinfo` out of Git. CI runs Gitleaks, rejects tracked log/build metadata, and runs `npm audit --audit-level=high`.
- [ ] Review Dependabot pull requests for npm packages and GitHub Actions weekly.

## Pre-launch penetration test

- [ ] Test authentication, OTP expiry/replay, password reset, session revocation, CSRF, App Check, and reauthentication bypass attempts.
- [ ] Test role boundaries and direct API access for every route, including uploader/approver/admin/superadmin authorization and IDOR across student and certificate IDs.
- [ ] Test IP/CIDR and country enforcement through the actual production proxy chain; spoof forwarded headers, change countries mid-session, and exercise expired and active break-glass exceptions.
- [ ] Test upload request-size handling before body parsing; malformed multipart bodies; mismatched extension/MIME/magic bytes; encrypted, malformed, and over-page-limit PDFs; oversized image dimensions; and quota reset/bypass attempts.
- [ ] Test R2 object-key isolation, signed URL expiry, replacement/deletion lifecycle, stored XSS in rendered metadata, and malware scan failure behavior.
- [ ] Test rate limits, enumeration resistance, export/backup authorization, PII exposure in responses/logs, and audit-log integrity.
- [ ] Retest fixes, record findings and owners, and block launch on unresolved critical or high severity findings.
