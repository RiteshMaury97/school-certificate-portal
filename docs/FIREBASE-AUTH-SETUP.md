# Firebase and administrator email-code setup

The portal uses Firebase Authentication (Spark-compatible) for the first sign-in step and a custom six-digit email code for the second step. The code is generated and verified by the application server and delivered only through Gmail SMTP. No paid Identity Platform feature is required.

## 1. Firebase project

1. Create or select the Firebase project on the Spark plan.
2. Register the web application and copy its API key, Auth domain, project ID and app ID into the matching `NEXT_PUBLIC_FIREBASE_*` variables.
3. In Firebase Console → Authentication → Sign-in method, enable Email/Password and Google if Google sign-in is wanted.
4. In Authentication → Settings → Authorized domains, add the production hostname and localhost for development.
5. Do not upgrade the project for sign-in factors; the application handles the email code itself.

## 2. Gmail SMTP and App Password

Use a dedicated school mailbox. Administrator mailboxes should enforce Google 2-Step Verification because this mailbox delivers the portal's sign-in codes and security alerts.

1. Sign in to the Google account that will send school mail.
2. Open Google Account → Security → How you sign in to Google.
3. Enable **2-Step Verification** and complete Google's setup.
4. Return to Google Account → Security → **App passwords**. Create an App Password (for example, name it `School Certificate Portal`). Google displays a one-time 16-character password; copy it immediately and store it in your deployment's secret manager. If App passwords is unavailable, check the account's Workspace administrator policy and account eligibility.
5. Set `GMAIL_USER` to the mailbox address and `GMAIL_APP_PASSWORD` to the generated App Password. Optionally set `GMAIL_FROM_NAME`; otherwise the configured school name is used.
6. Keep all Gmail values server-side. Never add a `NEXT_PUBLIC_` prefix or commit real credentials. SMTP uses `smtp.gmail.com` on port 465 with TLS.

The application reserves a maximum of **500 recipients per UTC day** in Firestore `abuseCounters` and logs a warning at 400. A message sent to multiple recipients counts each recipient. Gmail may impose lower account-specific sending limits, so use a dedicated Workspace mailbox for operational mail and avoid treating this quota as a Gmail guarantee.

All outgoing application email must go through `src/server/mailer.ts`. Do not create additional SMTP transports or email-provider integrations.

## 3. Other required server settings

Configure Firebase Admin credentials, `AUDIT_LOG_HMAC_SECRET` (at least 32 bytes), App Check settings, and the remaining environment values described in `.env.example`. The code is stored as an identity-bound HMAC digest in Firestore, expires after 10 minutes, allows five incorrect verification attempts, and can be resent no more often than every 60 seconds.

## 4. Sign-in flow

```text
Email/password or Google credentials
              │
              ▼
       Firebase first factor
              │
              ▼
  Existing login-check + preflight
              │
              ▼
  Email verification (if required)
              │
              ▼
    Send six-digit Gmail code
              │
              ▼
       Verify email code
              │
              ▼
 POST /api/admin/session { idToken, challengeId }
              │
              ▼
 Consume challenge → issue HttpOnly session → browser Firebase sign-out
```

The code is valid for 10 minutes, permits at most five incorrect attempts, and a verified challenge must be consumed within five minutes. Resend is limited to once every 60 seconds and five sends per account per hour. Challenge documents store only an HMAC digest, never the plaintext code.

## 5. First superadministrator

1. Create the first user in Firebase Console → Authentication → Users, or let the user create an account through an enabled provider.
2. Verify the account email.
3. Run `npm run admin:create-superadmin -- admin@school.example` using the exact verified address.
4. Confirm the matching `admins/{uid}` record has the `superadmin` role and active status.
5. The user signs in with email/password or Google, receives a six-digit code at the verified email address, and enters it to establish the server session.

## 6. Troubleshooting

| Symptom                                              | Check                                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `auth/operation-not-allowed` during password sign-in | Enable Email/Password in Firebase Authentication → Sign-in method.                                                                 |
| Google sign-in is unavailable                        | Enable Google and configure its support email and authorized domains.                                                              |
| Code email is not delivered                          | Check Gmail App Password, mailbox security settings, SMTP credentials and server logs.                                             |
| Code is invalid or expired                           | Request a new code; each code expires after 10 minutes and allows five incorrect attempts.                                         |
| Too many code requests                               | Wait at least 60 seconds before requesting another code.                                                                           |
| Session rejected after code entry                    | Confirm the Firebase ID token belongs to the same project and the matching `admins/{uid}` record is active with the expected role. |

## 7. Local development

Use `http://localhost:<port>` or `http://127.0.0.1:<port>` and configure the Firebase authorized domain `localhost`. App Check can be skipped locally according to the existing `APP_CHECK_ENFORCE` development policy. Do not expose the Gmail app password to browser code.

## Administrator email verification codes

Administrator sign-in uses Firebase Authentication for the first factor and a custom six-digit code sent through the configured Gmail SMTP account for the second factor. Configure `OTP_HMAC_SECRET` with at least 32 random bytes; it must be separate from `AUDIT_LOG_HMAC_SECRET`. The code is stored only as an HMAC in the server-only `adminOtpChallenges` collection, expires after 10 minutes, and allows at most five attempts. The verified challenge is consumed when the server creates a session and is valid for that step for five minutes. No client Firestore access is permitted to this collection.

## Outgoing email (Gmail SMTP only)

All application email must go through `src/server/mailer.ts`; do not create route-specific SMTP transports or call Nodemailer elsewhere.

1. Enable 2-Step Verification on the Google account.
2. Create a Google App Password for the school mailbox.
3. Configure `GMAIL_USER` and `GMAIL_APP_PASSWORD` in the server environment. Optionally set `GMAIL_FROM_NAME`; if omitted, the school name from `siteSettings/main` is used.
4. `OTP_HMAC_SECRET` must be a separate random secret of at least 32 bytes. It is used to protect administrator email-code challenges and is not a Gmail credential.
5. SMTP uses `smtp.gmail.com` on port 465 with TLS and a 10-second connection/greeting/socket timeout.

The mailer reserves recipient capacity in the `abuseCounters` collection. The daily application cap is 500 recipients, with a warning logged at 400. Bulk parent notifications use the same counter and therefore cannot bypass the cap. Gmail may impose lower account-specific limits.

In development only, when Gmail credentials are missing, administrator verification codes are printed as a clearly marked development fallback. This fallback is disabled in production and must never be used to test production credentials.
