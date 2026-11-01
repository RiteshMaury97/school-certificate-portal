import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { FieldValue } from "firebase-admin/firestore";

import { db } from "./firebase-admin";
import { escapeHtml, sendMail } from "./mailer";
import { getRequestOrigin, type RequestLike } from "./request-origin";

export type AdminLocationMode = "off" | "alert" | "block";
export type AdminLocationException = {
  id: string;
  country?: string;
  adminUid?: string;
  expiresAt: string;
  reason: string;
  addedBy: string;
  createdAt: string;
};
export type AdminLocationPolicy = {
  allowedAdminCountries: string[];
  adminIpAllowlist: string[];
  adminLocationEnforcementMode: AdminLocationMode;
  adminLocationExceptions: AdminLocationException[];
};

const DEFAULT_COUNTRIES = ["IN"];
const MAX_EXCEPTION_MS = 7 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isCountry(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

type ExceptionFields = {
  id: string;
  expiresAt: string;
  reason: string;
  addedBy: string;
  createdAt: string;
};

function hasExceptionFields(
  value: Record<string, unknown>,
): value is Record<string, unknown> & ExceptionFields {
  return (
    nonEmptyString(value.id) &&
    nonEmptyString(value.expiresAt) &&
    nonEmptyString(value.reason) &&
    nonEmptyString(value.addedBy) &&
    nonEmptyString(value.createdAt)
  );
}

export function normalizeAdminLocationPolicy(value: unknown): AdminLocationPolicy {
  const data = record(value);
  const countries = Array.isArray(data.allowedAdminCountries)
    ? data.allowedAdminCountries.filter(
        (item): item is string => typeof item === "string" && /^[A-Z]{2}$/.test(item),
      )
    : DEFAULT_COUNTRIES;
  const allowlist = Array.isArray(data.adminIpAllowlist)
    ? data.adminIpAllowlist.filter(
        (item): item is string => typeof item === "string" && isValidCidr(item),
      )
    : [];
  const mode = data.adminLocationEnforcementMode;
  const exceptions = Array.isArray(data.adminLocationExceptions)
    ? data.adminLocationExceptions
        .map((item) => normalizeException(item))
        .filter((item): item is AdminLocationException => item !== null)
    : [];
  return {
    allowedAdminCountries: countries.length ? [...new Set(countries)] : DEFAULT_COUNTRIES,
    adminIpAllowlist: [...new Set(allowlist)],
    adminLocationEnforcementMode:
      mode === "off" || mode === "alert" || mode === "block"
        ? mode
        : process.env.NODE_ENV === "production"
          ? "block"
          : "off",
    adminLocationExceptions: exceptions,
  };
}

function normalizeException(value: unknown): AdminLocationException | null {
  const item = record(value);
  if (!hasExceptionFields(item)) return null;
  const country = isCountry(item.country) ? item.country : undefined;
  const adminUid = nonEmptyString(item.adminUid) ? item.adminUid : undefined;
  return country || adminUid
    ? {
        id: item.id,
        ...(country ? { country } : {}),
        ...(adminUid ? { adminUid } : {}),
        expiresAt: item.expiresAt,
        reason: item.reason,
        addedBy: item.addedBy,
        createdAt: item.createdAt,
      }
    : null;
}

function ipv4Number(address: string): bigint | null {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return null;
  return parts.reduce((value, part) => (value << 8n) | BigInt(part), 0n);
}

function ipv6Number(address: string): bigint | null {
  let input = address.toLowerCase().split("%")[0] ?? address.toLowerCase();
  const dotted = /(?:^|:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(input);
  if (dotted?.[1]) {
    const v4 = ipv4Number(dotted[1]);
    if (v4 === null) return null;
    input = input.replace(
      dotted[1],
      `${Number((v4 >> 16n) & 0xffffn).toString(16)}:${Number(v4 & 0xffffn).toString(16)}`,
    );
  }
  const [leftPart = "", rightPart = ""] = input.split("::");
  const left = leftPart ? leftPart.split(":") : [];
  const right = rightPart ? rightPart.split(":") : [];
  const missing = 8 - left.length - right.length;
  const middle = Array.from({ length: Math.max(0, missing) }, () => "0");
  const groups = input.includes("::") ? [...left, ...middle, ...right] : left;
  if (groups.length !== 8 || groups.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return groups.reduce((value, part) => (value << 16n) | BigInt(`0x${part}`), 0n);
}

function ipNumber(address: string): { bits: number; value: bigint } | null {
  if (isIP(address) === 4) {
    const value = ipv4Number(address);
    return value === null ? null : { bits: 32, value };
  }
  if (isIP(address) !== 6) return null;
  const value = ipv6Number(address);
  return value === null ? null : { bits: 128, value };
}

export function isValidCidr(cidr: string): boolean {
  const parts = cidr.trim().split("/");
  if (parts.length > 2) return false;
  const [address = "", prefix = ""] = parts;
  const parsed = ipNumber(address);
  if (!parsed) return false;
  const width = prefix === "" ? parsed.bits : Number(prefix);
  return Number.isInteger(width) && width >= 0 && width <= parsed.bits;
}

export function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!isValidCidr(cidr)) return false;
  const [network = "", prefix = ""] = cidr.trim().split("/");
  const candidate = ipNumber(ip);
  const subnet = ipNumber(network);
  if (candidate?.bits !== subnet?.bits) return false;
  if (!candidate || !subnet) return false;
  const width = prefix === "" ? subnet.bits : Number(prefix);
  const shift = BigInt(subnet.bits - width);
  return candidate.value >> shift === subnet.value >> shift;
}

export function isAdminLocationAllowed(input: {
  policy: AdminLocationPolicy;
  country: string | null;
  ip: string | null;
  adminUid?: string;
  now?: number;
}): boolean {
  const { policy, country, ip } = input;
  if (policy.adminLocationEnforcementMode === "off") return true;
  if (country && policy.allowedAdminCountries.includes(country.toUpperCase())) return true;
  if (ip && policy.adminIpAllowlist.some((cidr) => ipMatchesCidr(ip, cidr))) return true;
  const now = input.now ?? Date.now();
  return policy.adminLocationExceptions.some((exception) => {
    if (Date.parse(exception.expiresAt) <= now) return false;
    return (
      (country?.toUpperCase() === exception.country && exception.country !== undefined) ||
      (input.adminUid === exception.adminUid && input.adminUid !== undefined)
    );
  });
}

export async function readAdminLocationPolicy(): Promise<AdminLocationPolicy> {
  const settings = await db.collection("siteSettings").doc("main").get();
  return normalizeAdminLocationPolicy(settings.data());
}

export function hashLocationIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32)
    throw new Error("AUDIT_LOG_HMAC_SECRET is not configured");
  return createHmac("sha256", secret).update(ip, "utf8").digest("hex");
}

export async function auditAdminLocation(input: {
  action:
    | "admin.location.blocked"
    | "admin.location.alert"
    | "admin.location.session_country_changed"
    | "admin.location.exception_added";
  country: string | null;
  ip: string | null;
  uid?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.collection("auditLogs").add({
    actorUid: input.uid ?? "system:admin-location-policy",
    action: input.action,
    targetId: input.targetId ?? input.country ?? "unknown",
    country: input.country,
    ipHash: hashLocationIp(input.ip),
    ...(input.details ? { details: input.details } : {}),
    timestamp: FieldValue.serverTimestamp(),
  });
}

export type AdminSessionDocument = {
  id: string;
  set(value: Record<string, unknown>, options: { merge: boolean }): Promise<unknown>;
};

async function revokeChangedCountrySession(input: {
  sessionRef: AdminSessionDocument;
  adminUid?: string;
  country: string;
  ip: string | null;
}): Promise<void> {
  await input.sessionRef.set(
    { revokedAt: FieldValue.serverTimestamp(), revokeReason: "country_changed" },
    { merge: true },
  );
  await auditAdminLocation({
    action: "admin.location.session_country_changed",
    country: input.country,
    ip: input.ip,
    ...(input.adminUid ? { uid: input.adminUid } : {}),
    targetId: input.sessionRef.id,
  });
  if (!input.adminUid) return;
  const admin = await db.collection("admins").doc(input.adminUid).get();
  const email = String(admin.get("email") ?? "");
  if (email)
    await sendMail({
      to: email,
      subject: "Admin session ended after a location change",
      html: `<p>Your school admin session was ended because it was accessed from a different country (${escapeHtml(input.country)}). Sign in again and verify using the emailed code.</p>`,
    }).catch(() => null);
}

export async function enforceAdminLocation(input: {
  request: RequestLike;
  adminUid?: string;
  sessionCountry?: string | null;
  sessionRef?: AdminSessionDocument;
}): Promise<{
  allowed: boolean;
  country: string | null;
  ip: string | null;
  reason?: "policy" | "country_changed";
}> {
  const origin = getRequestOrigin(input.request);
  const policy = await readAdminLocationPolicy();
  if (
    input.sessionRef &&
    input.sessionCountry &&
    origin.country &&
    input.sessionCountry !== origin.country
  ) {
    await revokeChangedCountrySession({
      sessionRef: input.sessionRef,
      ...(input.adminUid ? { adminUid: input.adminUid } : {}),
      country: origin.country,
      ip: origin.ip,
    });
    return { allowed: false, country: origin.country, ip: origin.ip, reason: "country_changed" };
  }
  const allowed = isAdminLocationAllowed({
    policy,
    country: origin.country,
    ip: origin.ip,
    ...(input.adminUid ? { adminUid: input.adminUid } : {}),
  });
  if (allowed) return { allowed: true, country: origin.country, ip: origin.ip };
  const mode = policy.adminLocationEnforcementMode;
  await auditAdminLocation({
    action: mode === "alert" ? "admin.location.alert" : "admin.location.blocked",
    country: origin.country,
    ip: origin.ip,
    ...(input.adminUid ? { uid: input.adminUid } : {}),
  });
  return { allowed: mode !== "block", country: origin.country, ip: origin.ip, reason: "policy" };
}

export const ADMIN_LOCATION_EXCEPTION_MAX_MS = MAX_EXCEPTION_MS;
