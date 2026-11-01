import { createHmac } from "node:crypto";

import { NextResponse } from "next/server";

import { incrementDailySecurityMetric } from "./daily-security-summary";
import { db } from "./firebase-admin";
import { hashRequesterIp, requesterCountry, requesterIp } from "./request-origin";
import {
  didSessionCountryChange,
  isAdminLocationAllowed,
  isValidIpCidr,
  ipMatchesCidr,
} from "../shared/admin-location-policy";

import type { AdminLocationPolicy } from "../shared/admin-location-policy";
import type { NextRequest } from "next/server";

export {
  didSessionCountryChange,
  isAdminLocationAllowed,
  isBreakGlassActive,
  isValidIpCidr,
  ipMatchesCidr,
} from "../shared/admin-location-policy";

const settingsRef = () => db.collection("siteSettings").doc("main");
const exceptionCollection = () => db.collection("adminLocationExceptions");

export function defaultAdminLocationPolicy(): AdminLocationPolicy {
  return {
    allowedAdminCountries: ["IN"],
    adminIpAllowlist: [],
    adminEnforcementMode: process.env.NODE_ENV === "production" ? "block" : "off",
  };
}

export async function getAdminLocationPolicy(): Promise<AdminLocationPolicy> {
  const snapshot = await settingsRef().get();
  const defaults = defaultAdminLocationPolicy();
  const countries: unknown = snapshot.get("allowedAdminCountries");
  const cidrs: unknown = snapshot.get("adminIpAllowlist");
  const mode: unknown = snapshot.get("adminEnforcementMode");
  return {
    allowedAdminCountries: Array.isArray(countries)
      ? countries
          .filter((country): country is string => typeof country === "string")
          .map((country) => country.toUpperCase())
      : defaults.allowedAdminCountries,
    adminIpAllowlist: Array.isArray(cidrs)
      ? cidrs.filter((cidr): cidr is string => typeof cidr === "string" && isValidIpCidr(cidr))
      : defaults.adminIpAllowlist,
    adminEnforcementMode:
      mode === "off" || mode === "alert" || mode === "block" ? mode : defaults.adminEnforcementMode,
  };
}

async function activeExceptions(country: string, adminUid?: string) {
  const now = new Date();
  const snapshot = await exceptionCollection().where("expiresAt", ">", now).limit(200).get();
  return snapshot.docs.filter((doc) => {
    const data: unknown = doc.data();
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    return (
      (country && "country" in data && data.country === country) ||
      (adminUid && "adminUid" in data && data.adminUid === adminUid)
    );
  });
}

export async function evaluateAdminLocation(request: NextRequest, adminUid?: string) {
  const [policy, ip] = await Promise.all([
    getAdminLocationPolicy(),
    Promise.resolve(requesterIp(request)),
  ]);
  const country = requesterCountry(request).toUpperCase();
  const ipAllowed = Boolean(ip && policy.adminIpAllowlist.some((cidr) => ipMatchesCidr(ip, cidr)));
  const countryAllowed = Boolean(country && policy.allowedAdminCountries.includes(country));
  const exceptions = await activeExceptions(country, adminUid);
  const exceptionAllowed = exceptions.length > 0;
  return {
    allowed: isAdminLocationAllowed(policy, country, ip, exceptionAllowed),
    policy,
    country,
    ipHash: hashRequesterIp(request),
    reason: countryAllowed
      ? "allowed_country"
      : ipAllowed
        ? "ip_allowlist"
        : exceptionAllowed
          ? "break_glass"
          : "location_not_allowed",
    exceptions: exceptions.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

export async function auditAdminLocation(
  request: NextRequest,
  input: {
    actorUid?: string | undefined;
    country: string;
    action:
      "admin.location.block" | "admin.location.alert" | "admin.location.session_country_change";
    reason: string;
  },
): Promise<void> {
  if (input.action === "admin.location.block")
    await incrementDailySecurityMetric("blockedLocations").catch(() => null);
  await db.collection("auditLogs").add({
    actorUid: input.actorUid ?? "public",
    action: input.action,
    targetId: "admin-location-policy",
    country: input.country,
    reason: input.reason,
    ipHash: hashRequesterIp(request),
    timestamp: new Date(),
  });
}

export async function enforceAdminLocation(
  request: NextRequest,
  adminUid?: string,
): Promise<NextResponse | null> {
  const decision = await evaluateAdminLocation(request, adminUid);
  if (decision.allowed) return null;
  if (decision.policy.adminEnforcementMode !== "block") return null;
  await auditAdminLocation(request, {
    actorUid: adminUid,
    country: decision.country,
    action: "admin.location.block",
    reason: decision.reason,
  });
  return NextResponse.json(
    { error: "Access denied." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export async function revokeSessionOnCountryChange(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get("sis_admin_session")?.value;
  if (!cookie) return false;
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("Audit secret unavailable");
  const sessionHash = createHmac("sha256", secret).update(cookie).digest("hex");
  const sessionRef = db.collection("adminSessions").doc(sessionHash);
  const session = await sessionRef.get();
  if (!session.exists || session.get("revokedAt")) return false;
  const oldCountry = String(session.get("country") ?? "").toUpperCase();
  const country = requesterCountry(request).toUpperCase();
  if (!didSessionCountryChange(oldCountry, country)) return false;
  const adminUid = String(session.get("uid") ?? "");
  await sessionRef.set({ revokedAt: new Date(), revokeReason: "country_changed" }, { merge: true });
  await auditAdminLocation(request, {
    actorUid: adminUid,
    country,
    action: "admin.location.session_country_change",
    reason: "country_changed",
  });
  const email = String(session.get("email") ?? "");
  if (email) {
    await sendLocationChangeNotice(email, oldCountry, country);
  }
  return true;
}

async function sendLocationChangeNotice(
  email: string,
  oldCountry: string,
  country: string,
): Promise<void> {
  const { sendMail } = await import("./mailer");
  await sendMail({
    to: email,
    subject: "School Portal: administrator sign-in location changed",
    text: `Your administrator session was revoked because its country changed from ${oldCountry || "unknown"} to ${country || "unknown"}. Sign in again and verify the emailed code. If this was not you, contact the school superadministrator.`,
  }).catch(() => null);
}

export async function sessionAdminUid(request: NextRequest): Promise<string | undefined> {
  const cookie = request.cookies.get("sis_admin_session")?.value;
  if (!cookie) return undefined;
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) return undefined;
  const sessionHash = createHmac("sha256", secret).update(cookie).digest("hex");
  const session = await db.collection("adminSessions").doc(sessionHash).get();
  const uid: unknown = session.get("uid");
  return session.exists && !session.get("revokedAt") && typeof uid === "string" ? uid : undefined;
}

export async function listAdminLocationExceptions() {
  const snapshot = await exceptionCollection().orderBy("expiresAt", "desc").limit(50).get();
  return snapshot.docs.map((doc): Record<string, unknown> => ({ id: doc.id, ...doc.data() }));
}
