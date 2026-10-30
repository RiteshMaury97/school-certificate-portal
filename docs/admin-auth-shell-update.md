# Administrator authentication and shell update

## Authentication

- Email/password and Google sign-in both use Firebase Authentication.
- Google sign-in uses `GoogleAuthProvider` with popup on desktop and redirect on mobile; popup-blocked cases fall back to redirect.
- Firebase TOTP MFA is the mandatory second factor for both providers. Accounts without an enrolled TOTP factor are required to enroll one before the portal can establish a server session. On later sign-ins Firebase returns its MFA resolver, and the user must complete the TOTP assertion.
- The server verifies the Firebase ID token, requires a verified email, an existing `admins/{uid}` record, a matching email, an allowed role, an active `status: active` record, and a completed TOTP/email second-factor claim before creating the HttpOnly session cookie.
- No admin account is created by Google sign-in. An unapproved Google account is signed out and shown the generic message `This account is not authorized.`
- Password reset uses Firebase's reset flow and always displays the same neutral response to avoid account enumeration.
- Existing lockout, new-device alert, inactivity timeout, session revocation, all-device sign-out and step-up re-authentication endpoints are retained.

## Admin shell

- The existing role-filtered admin workspace now uses lucide icons, icon-only tablet navigation with accessible tooltips, a mobile navigation drawer, notification/support shortcut, theme/contrast controls and an avatar/profile menu.
- Existing active-session management and sign-out-everywhere controls remain in the profile menu.
- Server APIs continue to authorize each request using the HttpOnly admin session and role policy. Middleware redirects page requests without a session cookie to the login page; API routes still validate the session cryptographically.

## Existing admin page architecture

Route-level page wrappers remain separate files under `src/pages/admin/`. They currently reuse the legacy shared admin workspace (`src/screens/AdminPage.tsx`) rather than each being a fully independent implementation. Existing workspace filters, paging and data-loading behavior have been preserved; this update does not claim that every admin data endpoint has been converted to server-side pagination.

## Deployment checks

1. Run `npm install` to regenerate `package-lock.json` for `lucide-react`.
2. Run `npm run typecheck`, `npm run lint`, and `npm test`.
3. Test Google popup and redirect flows on desktop/mobile, new and enrolled TOTP accounts, unapproved Google accounts, disabled admin records, lockout, device alerts, idle timeout and all-device revocation.
4. Verify 320px, 360px, 768px, 1024px and desktop layouts with keyboard and screen-reader checks.
