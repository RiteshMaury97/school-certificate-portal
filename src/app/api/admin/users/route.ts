import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { adminAuth, db } from "@/server/firebase-admin";
import { sendAdminInvitationEmail } from "@/server/mailer";
import { requireAdmin, requireSensitiveReauth, writeAuditLog, apiError } from "@/server/security";
import { absoluteUrl } from "@/server/site-origin";
import { adminInviteProfileSchema, adminInviteSchema } from "@/shared/validation";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
function ignoreCleanupFailure(error: unknown): void {
  if (error instanceof Error) console.warn("Could not clean up failed administrator invitation", error.message);
}

function isAdminRole(value: unknown): value is "uploader" | "approver" | "admin" | "superadmin" {
  return value === "uploader" || value === "approver" || value === "admin" || value === "superadmin";
}

type AdminUpdate = {
  uid: string;
  disabled?: boolean;
  role?: "uploader" | "approver" | "admin" | "superadmin";
  profile?: unknown;
};

function parseAdminUpdate(value: unknown): AdminUpdate | null {
  if (typeof value !== "object" || value === null || !("uid" in value) || typeof value.uid !== "string") return null;
  const input = value;
  if ("disabled" in input && typeof input.disabled !== "boolean") return null;
  if ("role" in input && !isAdminRole(input.role)) return null;
  return {
    uid: input.uid,
    ...(typeof input.disabled === "boolean" ? { disabled: input.disabled } : {}),
    ...(isAdminRole(input.role) ? { role: input.role } : {}),
    ...("profile" in input ? { profile: input.profile } : {}),
  };
}

async function applyAdminUpdate(input: {
  actorUid: string;
  update: AdminUpdate;
  profile: ReturnType<typeof adminInviteProfileSchema.safeParse> | null;
}): Promise<void> {
  const { actorUid, update, profile } = input;
  const changes: Record<string, unknown> = { updatedAt: new Date(), updatedBy: actorUid };
  if (typeof update.disabled === "boolean") {
    await adminAuth.updateUser(update.uid, { disabled: update.disabled });
    changes.status = update.disabled ? "disabled" : "active";
  }
  if (update.role) {
    const target = await adminAuth.getUser(update.uid);
    await adminAuth.setCustomUserClaims(update.uid, { ...target.customClaims, role: update.role });
    changes.role = update.role;
  }
  if (profile?.success) {
    const current = await db.collection("admins").doc(update.uid).get();
    const currentProfile: unknown = current.get("profile");
    changes.profile = {
      ...(typeof currentProfile === "object" && currentProfile !== null ? currentProfile : {}),
      ...profile.data,
    };
    changes.profileUpdatedAt = new Date();
  }
  await db.collection("admins").doc(update.uid).update(changes);
}
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
        url: absoluteUrl("/admin/login"),
      });
      const site = await db.collection("siteSettings").doc("main").get();
      const schoolName =
        String(site.get("schoolName") ?? "").trim() || "Satyam International School";
      await sendAdminInvitationEmail({
        to: email,
        role,
        temporaryPassword,
        verificationLink,
        schoolName,
        recipientName: parsed.data.profile.preferredName || parsed.data.profile.name,
        tagline: String(site.get("tagline") ?? ""),
        boardName: String(site.get("boardName") ?? ""),
        affiliationNumber: String(site.get("affiliationNumber") ?? ""),
        schoolCode: String(site.get("schoolCode") ?? ""),
        address: String(site.get("address") ?? ""),
        phone: String(site.get("phone") ?? ""),
        email: String(site.get("email") ?? ""),
      });
    } catch (error) {
      await Promise.all([
        adminAuth.deleteUser(user.uid).catch(ignoreCleanupFailure),
        db
          .collection("admins")
          .doc(user.uid)
          .delete()
          .catch(ignoreCleanupFailure),
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
    const update = parseAdminUpdate(await request.json());
    if (!update)
      return NextResponse.json({ error: "Invalid administrator update." }, { status: 400 });
    const hasProfile = "profile" in update;
    const profileResult = hasProfile ? adminInviteProfileSchema.safeParse(update.profile) : null;
    if (hasProfile && !profileResult?.success)
      return NextResponse.json({ error: "Enter valid staff profile details." }, { status: 400 });
    if (update.disabled === undefined && update.role === undefined && !hasProfile)
      return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
    if (update.uid === actor.uid && update.disabled === true)
      return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
    if (update.uid === actor.uid && update.role)
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    await applyAdminUpdate({ actorUid: actor.uid, update, profile: profileResult });
    await writeAuditLog(
      request,
      actor.uid,
      hasProfile
        ? "admin.profile_edit"
        : update.role
          ? "admin.role_change"
          : update.disabled
            ? "admin.disable"
            : "admin.enable",
      update.uid,
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
    if (!target.exists)
      return NextResponse.json({ error: "Administrator account not found." }, { status: 404 });
    if (target.get("role") === "superadmin" && target.get("status") === "active") {
      const activeSuperadmins = await db
        .collection("admins")
        .where("role", "==", "superadmin")
        .where("status", "==", "active")
        .get();
      if (activeSuperadmins.size <= 1)
        return NextResponse.json(
          { error: "You cannot delete the last active superadmin." },
          { status: 400 },
        );
    }

    await adminAuth.deleteUser(uid);
    await targetRef.delete();
    await writeAuditLog(request, actor.uid, "admin.delete", uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
