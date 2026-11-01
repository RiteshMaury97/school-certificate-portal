import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";


import { adminAuth, db } from "@/server/firebase-admin";
import { escapeHtml, sendMail } from "@/server/mailer";
import {
  requireAdmin,
  requireSensitiveReauth,
  writeAuditLog,
  apiError,
} from "@/server/security";
import { adminInviteProfileSchema, adminInviteSchema } from "@/shared/validation";

import type { NextRequest} from "next/server";
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
    const temporaryPassword = randomBytes(24).toString("base64url");
    const user = await adminAuth.createUser({
      email,
      emailVerified: false,
      disabled: false,
      password: temporaryPassword,
    });
    await adminAuth.setCustomUserClaims(user.uid, { role, mustChangePassword: true });
    await db
      .collection("admins")
      .doc(user.uid)
      .set({
        email,
        role,
        status: "invited",
        mustChangePassword: true,
        profile: {
          ...parsed.data.profile,
          bio: "",
          preferredLanguage: "en",
          timeZone: "Asia/Kolkata",
          dateFormat: "DD/MM/YYYY",
          photoDataUrl: "",
          emailNotifications: true,
          systemNotifications: true,
        },
        createdAt: new Date(),
        createdBy: actor.uid,
      });
    try {
      const verificationLink = await adminAuth.generateEmailVerificationLink(email, {
        url: `${process.env.APP_ORIGIN ?? request.nextUrl.origin}/admin/login`,
      });
      await sendMail({
        to: email,
        subject: "School Portal: administrator invitation",
        text: `You have been invited as a ${role}. Temporary password: ${temporaryPassword}\nSign in at ${process.env.APP_ORIGIN ?? request.nextUrl.origin}/admin/login, verify your email, then choose a new password. This temporary password must be changed before administrator access is granted.\nVerify your email: ${verificationLink}`,
        html: `<p>You have been invited as a ${escapeHtml(role)}.</p><p><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</p><p><a href="${escapeHtml(process.env.APP_ORIGIN ?? request.nextUrl.origin)}/admin/login">Sign in</a>, verify your email, then choose a new password. Administrator access is unavailable until you change this password.</p><p><a href="${escapeHtml(verificationLink)}">Verify your email</a></p>`,
      });
    } catch (error) {
      await Promise.all([
        adminAuth.deleteUser(user.uid).catch(() => undefined),
        db.collection("admins").doc(user.uid).delete().catch(() => undefined),
      ]);
      throw error;
    }
    await writeAuditLog(request, actor.uid, "admin.invite", user.uid);
    return NextResponse.json({ ok: true, email, role }, { status: 201 });
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
    const hasProfile = "profile" in body;
    const profileResult = hasProfile ? adminInviteProfileSchema.safeParse(body.profile) : null;
    if (hasProfile && !profileResult?.success)
      return NextResponse.json({ error: "Enter valid staff profile details." }, { status: 400 });
    if (disabled !== undefined && typeof disabled !== "boolean")
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    if (
      role !== undefined &&
      !(role === "uploader" || role === "approver" || role === "admin" || role === "superadmin")
    )
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    if (disabled === undefined && role === undefined && !hasProfile)
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
    if (profileResult?.success) {
      const current = await db.collection("admins").doc(uid).get();
      const currentProfile = current.get("profile");
      updates.profile = {
        ...(currentProfile && typeof currentProfile === "object" ? currentProfile : {}),
        ...profileResult.data,
      };
      updates.profileUpdatedAt = new Date();
    }
    await db.collection("admins").doc(uid).update(updates);
    await writeAuditLog(
      request,
      actor.uid,
      hasProfile ? "admin.profile_edit" : role ? "admin.role_change" : disabled ? "admin.disable" : "admin.enable",
      uid,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await superadmin(request);
    await requireSensitiveReauth(request, actor);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("uid" in body) || typeof body.uid !== "string")
      return NextResponse.json({ error: "Select a valid administrator account." }, { status: 400 });
    const uid = body.uid.trim();
    if (!uid || uid === actor.uid)
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });

    const targetRef = db.collection("admins").doc(uid);
    const target = await targetRef.get();
    if (!target.exists) return NextResponse.json({ error: "Administrator account not found." }, { status: 404 });
    if (target.get("role") === "superadmin" && target.get("status") === "active") {
      const activeSuperadmins = await db.collection("admins").where("role", "==", "superadmin").where("status", "==", "active").get();
      if (activeSuperadmins.size <= 1)
        return NextResponse.json({ error: "You cannot delete the last active superadmin." }, { status: 400 });
    }

    await adminAuth.deleteUser(uid);
    await targetRef.delete();
    await writeAuditLog(request, actor.uid, "admin.delete", uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
