import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";

import { adminAuth, db } from "@/server/firebase-admin";
import { apiError, requireAdmin, writeAuditLog } from "@/server/security";
import { isValidPhoneNumber } from "@/shared/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXT_LIMITS = {
  name: 80,
  preferredName: 80,
  staffId: 50,
  gender: 30,
  dateOfBirth: 10,
  position: 120,
  department: 120,
  designation: 120,
  campus: 120,
  joiningDate: 10,
  reportingManager: 100,
  officeLocation: 160,
  alternateEmail: 254,
  primaryPhone: 16,
  secondaryPhone: 16,
  address: 500,
  emergencyContactName: 100,
  emergencyContactPhone: 16,
  bio: 500,
  preferredLanguage: 10,
  timeZone: 80,
  dateFormat: 20,
  photoDataUrl: 300_000,
} as const;
type TextField = keyof typeof TEXT_LIMITS;
const TEXT_FIELDS = Object.keys(TEXT_LIMITS) as TextField[];
const BOOLEAN_FIELDS = ["emailNotifications", "systemNotifications"] as const;
type BooleanField = (typeof BOOLEAN_FIELDS)[number];
type Profile = Record<TextField, string> & Record<BooleanField, boolean>;

const emptyProfile: Profile = {
  name: "",
  preferredName: "",
  staffId: "",
  gender: "",
  dateOfBirth: "",
  position: "",
  department: "",
  designation: "",
  campus: "",
  joiningDate: "",
  reportingManager: "",
  officeLocation: "",
  alternateEmail: "",
  primaryPhone: "",
  secondaryPhone: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  bio: "",
  preferredLanguage: "en",
  timeZone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  photoDataUrl: "",
  emailNotifications: true,
  systemNotifications: true,
};

function validDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validPersonName(value: string) {
  return value.length >= 2 && value.length <= 80 && /^[\p{L}\p{M} .'-]+$/u.test(value);
}

function readProfile(value: unknown): Profile {
  const profile = { ...emptyProfile };
  if (!value || typeof value !== "object" || Array.isArray(value)) return profile;
  const stored = value as Record<string, unknown>;
  for (const field of TEXT_FIELDS) {
    const saved = stored[field];
    if (typeof saved === "string") profile[field] = saved;
  }
  // Preserve profile values saved by the earlier, smaller profile form.
  if (!profile.campus && typeof stored.location === "string") profile.campus = stored.location;
  if (!profile.primaryPhone && typeof stored.phone === "string")
    profile.primaryPhone = stored.phone;
  for (const field of BOOLEAN_FIELDS) {
    if (typeof stored[field] === "boolean") profile[field] = stored[field];
  }
  return profile;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const [admin, authUser] = await Promise.all([
      db.collection("admins").doc(actor.uid).get(),
      adminAuth.getUser(actor.uid),
    ]);
    const lastLogin = authUser.metadata.lastSignInTime;
    const createdAt = authUser.metadata.creationTime;
    return NextResponse.json(
      {
        profile: readProfile(admin.get("profile")),
        account: {
          email: actor.email,
          role: actor.role,
          status: authUser.disabled ? "disabled" : String(admin.get("status") ?? "active"),
          lastLogin: lastLogin ? new Date(lastLogin).toISOString() : null,
          createdAt: createdAt ? new Date(createdAt).toISOString() : null,
          twoFactorEnabled: true,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: "Enter valid profile details." }, { status: 400 });

    const input = body as Record<string, unknown>;
    const allowedFields = new Set<string>([...TEXT_FIELDS, ...BOOLEAN_FIELDS]);
    if (Object.keys(input).some((key) => !allowedFields.has(key)))
      return NextResponse.json({ error: "Profile contains unsupported fields." }, { status: 400 });

    const profile = { ...emptyProfile };
    for (const field of TEXT_FIELDS) {
      const value = input[field] ?? emptyProfile[field];
      if (typeof value !== "string")
        return NextResponse.json({ error: `Enter a valid ${field} value.` }, { status: 400 });
      const trimmed = value.trim();
      if (trimmed.length > TEXT_LIMITS[field])
        return NextResponse.json({ error: `The ${field} field is too long.` }, { status: 400 });
      profile[field] = trimmed;
    }
    for (const field of BOOLEAN_FIELDS) {
      const value = input[field] ?? emptyProfile[field];
      if (typeof value !== "boolean")
        return NextResponse.json({ error: `Enter a valid ${field} setting.` }, { status: 400 });
      profile[field] = value;
    }

    if (!validPersonName(profile.name))
      return NextResponse.json(
        { error: "Enter a name using 2 to 80 letters, spaces, periods, apostrophes or hyphens." },
        { status: 400 },
      );
    for (const [field, label] of [["preferredName", "Preferred name"], ["reportingManager", "Reporting manager"], ["emergencyContactName", "Emergency contact name"]] as const) {
      if (profile[field] && !validPersonName(profile[field]))
        return NextResponse.json({ error: `${label} must use 2 to 80 letters, spaces, periods, apostrophes or hyphens.` }, { status: 400 });
    }
    if (
      profile.gender &&
      !["female", "male", "nonbinary", "prefer-not-to-say", "self-described"].includes(
        profile.gender,
      )
    )
      return NextResponse.json({ error: "Choose a valid gender option." }, { status: 400 });
    if (!validDate(profile.dateOfBirth) || !validDate(profile.joiningDate))
      return NextResponse.json({ error: "Enter dates in YYYY-MM-DD format." }, { status: 400 });
    if (profile.alternateEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.alternateEmail))
      return NextResponse.json(
        { error: "Enter a valid alternate email address." },
        { status: 400 },
      );
    for (const [field, label] of [["primaryPhone", "Primary phone"], ["secondaryPhone", "Secondary phone"], ["emergencyContactPhone", "Emergency contact phone"]] as const) {
      if (profile[field] && !isValidPhoneNumber(profile[field]))
        return NextResponse.json({ error: `${label} must be a 10-digit Indian mobile number or an international number in E.164 format.` }, { status: 400 });
    }
    if (
      profile.photoDataUrl &&
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(profile.photoDataUrl)
    )
      return NextResponse.json({ error: "Upload a supported profile photo." }, { status: 400 });
    if (!["en", "hi", "bn", "mr", "gu", "pa", "ta", "te", "ur"].includes(profile.preferredLanguage))
      return NextResponse.json({ error: "Choose a supported language." }, { status: 400 });
    if (!["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].includes(profile.dateFormat))
      return NextResponse.json({ error: "Choose a supported date format." }, { status: 400 });
    try {
      new Intl.DateTimeFormat("en", { timeZone: profile.timeZone });
    } catch {
      return NextResponse.json({ error: "Enter a valid time zone." }, { status: 400 });
    }

    await db
      .collection("admins")
      .doc(actor.uid)
      .set({ profile, profileUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await writeAuditLog(request, actor.uid, "admin.profile_update", actor.uid);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return apiError(error);
  }
}
