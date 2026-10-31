import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/server/firebase-admin";
import { escapeHtml, sendMail } from "@/server/mailer";
import { sameOrigin, verifyRequestAppCheck } from "@/server/security";

export const runtime = "nodejs";
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("email" in body) || typeof body.email !== "string" || body.email.length > 254) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const email = body.email.trim().toLowerCase();
    if (email) {
      try {
        const link = await adminAuth.generatePasswordResetLink(email, { url: `${process.env.APP_ORIGIN ?? request.nextUrl.origin}/admin/login` });
        await sendMail({ to: email, subject: "School Portal: password reset", text: `Use this secure link to reset your password: ${link}\n\nIf you did not request this, ignore this email.`, html: `<p>Use the link below to reset your password:</p><p><a href="${escapeHtml(link)}">Reset password</a></p><p>If you did not request this, ignore this email.</p>` });
      } catch {
        // Keep the response identical for unknown and known accounts.
      }
    }
    return NextResponse.json({ accepted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Password reset could not be requested." }, { status: 503 });
  }
}
