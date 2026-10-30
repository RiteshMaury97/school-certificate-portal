# React Router sitemap

The Next.js `app/[...slug]/page.tsx` catch-all mounts the client-side React Router application for non-root paths. `/` remains served by `app/page.tsx`, which mounts the same application.

## Public

- `/` — Home
- `/certificates` — Find My Certificates
- `/certificates/results` — in-memory results; redirects to `/certificates` without a valid result/access token
- `/certificates/print` — in-memory print view; redirects without a valid result/access token
- `/verify` — Verify a Certificate
- `/faq` — FAQ
- `/contact` — Contact and support
- `/report-wrong-record` — Wrong-record support
- `/data-rights` — DPDP rights information
- `/terms` — Terms and Conditions
- `/privacy` — Privacy Policy
- `/offline`, `/maintenance`, and `*` — service and not-found states

## Admin

- `/admin/login`, `/admin/mfa`
- `/admin`, `/admin/students`, `/admin/certificates`, `/admin/certificates/upload`
- `/admin/approvals`, `/admin/sessions`, `/admin/tickets`, `/admin/audit`
- `/admin/settings`, `/admin/admins`, `/admin/backup`

All admin routes render the existing authenticated administration module, which selects the matching section from the route and remains subject to its existing role checks. Admin routes are marked `noindex, nofollow, noarchive`.

## Data handling

Student search results are passed to the results and print views using React Router in-memory navigation state. They are not placed in route parameters, query strings, or URL hashes. Certificate download API calls use the existing short-lived signed access token.
