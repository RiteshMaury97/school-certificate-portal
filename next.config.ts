import type { NextConfig } from "next";
const config: NextConfig = {
  // These settings are intentionally public client configuration. Keep secrets
  // out of this list; Next.js inlines each value into the browser bundle.
  env: {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ?? "",
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ?? "",
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "",
    APP_CHECK_ENFORCE: process.env.APP_CHECK_ENFORCE ?? "",
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY ?? "",
    DATA_HOSTING_REGION: process.env.DATA_HOSTING_REGION ?? "",
    RETENTION_YEARS: process.env.RETENTION_YEARS ?? "",
    PRIVACY_POLICY_VERSION: process.env.PRIVACY_POLICY_VERSION ?? "",
    TERMS_VERSION: process.env.TERMS_VERSION ?? "",
    BROWSER_SENTRY_DSN: process.env.BROWSER_SENTRY_DSN ?? "",
    PLAUSIBLE_DOMAIN: process.env.PLAUSIBLE_DOMAIN ?? "",
    PLAUSIBLE_SCRIPT_URL: process.env.PLAUSIBLE_SCRIPT_URL ?? "",
  },
  rewrites() {
    return {
      beforeFiles: [{ source: "/offline", destination: "/offline.html" }],
    };
  },
  headers() {
    const production = process.env.NODE_ENV === "production";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          ...(production
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  serverExternalPackages: [
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "firebase-admin",
    "sharp",
    "archiver",
    "exceljs",
    "nodemailer",
  ],
  outputFileTracingIncludes: {
    "/api/certificates/[certId]/file": ["./public/fonts/*.ttf"],
    "/api/certificates/bundle": ["./public/fonts/*.ttf"],
    "/api/certificates/print": ["./public/fonts/*.ttf"],
    "/api/public/report": ["./public/fonts/*.ttf"],
  },
};
export default config;
