import { NextResponse } from "next/server";

import { createEncryptedExport } from "@/server/encrypted-export";
import { db } from "@/server/firebase-admin";
import { apiError, requireRoles, requireSensitiveReauth, writeAuditLog } from "@/server/security";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    await requireSensitiveReauth(request, admin);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object")
      return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
    const format = "format" in body ? String(body.format) : "json";
    const passphrase =
      "passphrase" in body ? String((body as { passphrase?: unknown }).passphrase ?? "") : "";
    if (format !== "json" && format !== "csv")
      return NextResponse.json({ error: "Choose JSON or CSV." }, { status: 400 });
    if (passphrase && passphrase.length < 12)
      return NextResponse.json(
        { error: "Use a passphrase of at least 12 characters." },
        { status: 400 },
      );
    const encrypted = await createEncryptedExport(format, passphrase || undefined);
    const id = db.collection("exportLogs").doc().id;
    await db.collection("exportLogs").doc(id).set({
      actorUid: admin.uid,
      format,
      encrypted: true,
      size: encrypted.length,
      createdAt: new Date(),
    });
    await writeAuditLog(request, admin.uid, "data.export", id);
    return new NextResponse(new Uint8Array(encrypted), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="school-portal-export-${new Date().toISOString().slice(0, 10)}.enc"`,
        "Cache-Control": "no-store",
        "X-Export-Format": format,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
