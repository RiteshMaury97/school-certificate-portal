import type { NextConfig } from "next";
const config: NextConfig = {
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
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};
export default config;
