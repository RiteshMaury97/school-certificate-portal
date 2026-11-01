# Architecture notes

## Routing
File-based Next.js App Router. Public pages are server components that export `metadata` (via
`lib/page-metadata`) and render a client view from `features/`. `app/template.tsx` replays the page
entrance animation on every navigation; `app/loading.tsx` shows the route skeleton.

The certificate result (which carries a short-lived access token) is passed between
`/certificates` → `/certificates/results` → `/certificates/print` through an in-memory React context
(`CertificateFlowProvider`, mounted in `app/certificates/layout.tsx`). It is never put in the URL or in
browser storage and is discarded when the visitor leaves `/certificates`.

## Admin console
`app/admin/(console)/layout.tsx` mounts `AdminSessionProvider` → `AdminGate` → `AdminConsole` once. The
section shown is derived from the pathname; the `page.tsx` files only provide the page title. Login
(`/admin/login`) sits outside this layout.

## Student record retention
The privacy policy states a configured retention period after the end of the academic session. There is no
automatic retention review or expiry job. Records may be deleted on request or after authorized
manual review, subject to legal holds and applicable recordkeeping requirements. Encrypted backups
continue to follow their configured rotation period.

## Known follow-up
`features/admin/AdminConsole.tsx` is still one ~3,600-line component (the ESLint `max-lines` rule of 600
already flags it). Split it into one component per section using the existing tab boundaries.
