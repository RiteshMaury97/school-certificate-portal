import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { adminAuth, db } from "@/src/lib/firebase-admin";
import {
  requireAdmin,
  requireSensitiveReauth,
  writeAuditLog,
  apiError,
} from "@/src/lib/security";
import { adminInviteSchema } from "@/src/lib/validation";
export const runtime = "nodejs";
async function superadmin(request: NextRequest) {
  const actor = await requireAdmin(request);
  if (actor.role !== "superadmin") throw new Error("FORBIDDEN");
  return actor;
}
export async function GET(request: NextRequest) {
  try {
    await superadmin(request);
    const snap = await db.collection("admins").limit(200).get();
    return NextResponse.json(
      { admins: snap.docs.map((d) => ({ uid: d.id, ...d.data() })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await superadmin(request);
    await requireSensitiveReauth(request, actor);
    const parsed = adminInviteSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Enter a valid administrator email and role." },
        { status: 400 },
      );
    const email = parsed.data.email.toLowerCase();
    const role = parsed.data.role;
    const user = await adminAuth.createUser({
      email,
      emailVerified: false,
      disabled: false,
      password: randomBytes(24).toString("base64url"),
    });
    await adminAuth.setCustomUserClaims(user.uid, { role });
    await db
      .collection("admins")
      .doc(user.uid)
      .set({
        email,
        role,
        status: "invited",
        createdAt: new Date(),
        createdBy: actor.uid,
      });
    const inviteLink = await adminAuth.generatePasswordResetLink(email);
    const verificationLink =
      await adminAuth.generateEmailVerificationLink(email);
    await writeAuditLog(request, actor.uid, "admin.invite", user.uid);
    return NextResponse.json(
      { ok: true, email, role, inviteLink, verificationLink },
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const actor = await superadmin(request);
    await requireSensitiveReauth(request, actor);
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("uid" in body) ||
      typeof body.uid !== "string"
    )
      return NextResponse.json(
        { error: "Invalid administrator update." },
        { status: 400 },
      );
    const uid = body.uid;
    const disabled = "disabled" in body ? body.disabled : undefined;
    const role = "role" in body ? body.role : undefined;
    if (disabled !== undefined && typeof disabled !== "boolean")
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    if (
      role !== undefined &&
      !(role === "uploader" || role === "approver" || role === "superadmin")
    )
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    if (disabled === undefined && role === undefined)
      return NextResponse.json(
        { error: "No changes supplied." },
        { status: 400 },
      );
    if (uid === actor.uid && disabled === true)
      return NextResponse.json(
        { error: "You cannot disable your own account." },
        { status: 400 },
      );
    if (uid === actor.uid && role)
      return NextResponse.json(
        { error: "You cannot change your own role." },
        { status: 400 },
      );
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: actor.uid,
    };
    if (typeof disabled === "boolean") {
      await adminAuth.updateUser(uid, { disabled });
      updates.status = disabled ? "disabled" : "active";
    }
    if (role) {
      const target = await adminAuth.getUser(uid);
      await adminAuth.setCustomUserClaims(uid, {
        ...target.customClaims,
        role,
      });
      updates.role = role;
    }
    await db.collection("admins").doc(uid).update(updates);
    await writeAuditLog(
      request,
      actor.uid,
      role ? "admin.role_change" : disabled ? "admin.disable" : "admin.enable",
      uid,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
