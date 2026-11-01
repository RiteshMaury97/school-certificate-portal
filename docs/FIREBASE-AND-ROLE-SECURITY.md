# Firebase Rules and Administrator Role Access

## Firestore client rules

`firebase/firestore.rules` intentionally denies every client SDK read and write.

The portal uses Firebase Authentication in the browser, but all Firestore data access is performed by Next.js route handlers using the Firebase Admin SDK. The Admin SDK bypasses Firestore Security Rules, so Firestore rules cannot enforce the portal's uploader/approver/superadmin roles. Those roles must be checked by the server on every protected route.

Do not add broad client-side `allow read` or `allow write` rules. If direct browser access is introduced in the future, add a collection-specific rule, prove the data model and role claims, and add emulator tests before deployment.

## Role matrix

| Capability / data area                      |                     Uploader |                     Approver | Superadmin |
| ------------------------------------------- | ---------------------------: | ---------------------------: | ---------: |
| Create/import student records               |                          Yes |                           No |        Yes |
| Upload and preview certificates             |                          Yes |                           No |        Yes |
| Read certificate review queues              |                           No |                          Yes |        Yes |
| Approve/reject certificate submissions      |                           No |                          Yes |        Yes |
| Revoke certificates                         |                           No |                          Yes |        Yes |
| Read certificate/student operational data   |   Scoped to upload workflows |             Review workflows |        Yes |
| Manage public catalog content               | Yes, as route policy permits | Yes, as route policy permits |        Yes |
| Read audit/timeline records                 |                           No |                          Yes |        Yes |
| Manage announcements                        |                           No |                          Yes |        Yes |
| Manage administrator accounts and roles     |                           No |                           No |        Yes |
| Change site settings and FAQs               |                           No |                           No |        Yes |
| Export/backup portal data                   |                           No |                           No |        Yes |
| Manage own sessions / revoke own sessions   |                          Yes |                          Yes |        Yes |

Superadmin is intentionally an override in `src/shared/role-policy.ts`. For non-superadmin roles, access is granted only when the route explicitly lists the role in `requireRoles`. Sensitive superadmin actions also require one-time reauthentication where implemented.

## Mandatory server checks

Every protected route must use `requireAdmin` or `requireRoles`. `requireAdmin` verifies the revocable Firebase session cookie, verified email, active Firestore admin record, matching email and role claim, CSRF for mutations, App Check, session revocation, inactivity timeout and absolute expiry.

`requireRoles` adds the route-specific role allowlist. Do not rely on hidden UI navigation or client-side role state as authorization.

## Deploy

From the project root:

```powershell
npm run firebase:deploy:rules
```

The command deploys the Firestore rules and indexes configured in `firebase.json`. Review the Firebase CLI project selection before deployment.

## Verification checklist

- [ ] Confirm Firebase Console points to the intended project.
- [ ] Deploy Firestore rules.
- [ ] Confirm direct client SDK reads/writes fail with `permission-denied`.
- [ ] Confirm active uploader can upload but cannot approve or export.
- [ ] Confirm active approver can review but cannot manage admins or backups.
- [ ] Confirm superadmin can access explicitly superadmin-gated routes.
- [ ] Confirm disabled/invited users cannot use existing session cookies.
- [ ] Confirm role changes update both Firestore `admins/{uid}` and Firebase Auth custom claims, then revoke old sessions / require fresh sign-in.
- [ ] Confirm student PII and certificate file bytes are returned only through authenticated, validated server routes or short-lived access tokens.

## Storage note

This project stores certificate objects in Cloudflare R2 through server-side code; it does not configure Firebase Storage rules. Protect R2 credentials as server-only secrets and never expose object keys or credentials to the browser. If Firebase Storage is enabled separately, configure and deploy a separate `storage.rules` file with default deny and narrowly scoped access.
