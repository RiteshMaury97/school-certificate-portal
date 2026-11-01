import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { verifyOptOutToken } from "@/server/notifications";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function page(token: string) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notification preferences</title><body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:1rem"><h1>Stop certificate notifications</h1><p>Confirm that you want to withdraw consent for future certificate availability messages.</p><form method="post"><input type="hidden" name="token" value="${token.replace(/[&<>"']/g, "")}"><button style="padding:.8rem 1rem">Confirm opt-out</button></form></body></html>`;
}
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    if (!(await verifyOptOutToken(token)))
      return new NextResponse("Invalid or expired opt-out link.", {
        status: 400,
      });
    return new NextResponse(page(token), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; form-action 'self'; style-src 'unsafe-inline'; base-uri 'none'",
      },
    });
  } catch {
    return new NextResponse("Opt-out is temporarily unavailable.", {
      status: 503,
    });
  }
}
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "");
    const verified = await verifyOptOutToken(token);
    if (!verified)
      return new NextResponse("Invalid or expired opt-out link.", {
        status: 400,
      });
    await db.collection("students").doc(verified.studentId).update({
      notificationConsent: false,
      notificationOptOut: true,
      notificationWithdrawnAt: FieldValue.serverTimestamp(),
      notificationConsentPurpose: FieldValue.delete(),
      parentEmail: FieldValue.delete(),
      parentMobile: FieldValue.delete(),
    });
    await db.collection("notificationConsents").add({
      studentId: verified.studentId,
      consentGiven: false,
      action: "withdrawn",
      timestamp: FieldValue.serverTimestamp(),
      purpose: "certificate_availability",
    });
    await db
      .collection("notificationOptOutTokens")
      .doc(verified.tokenHash)
      .update({ usedAt: FieldValue.serverTimestamp() });
    return new NextResponse(
      "Your notification consent has been withdrawn. No further certificate availability messages will be sent.",
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return new NextResponse("Opt-out is temporarily unavailable.", {
      status: 503,
    });
  }
}
