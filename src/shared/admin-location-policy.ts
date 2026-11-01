import { isIP } from "node:net";

export type AdminEnforcementMode = "off" | "alert" | "block";
export type AdminLocationPolicy = {
  allowedAdminCountries: string[];
  adminIpAllowlist: string[];
  adminEnforcementMode: AdminEnforcementMode;
};

export function isValidIpCidr(value: string): boolean {
  const [address, prefixText, ...extra] = value.trim().split("/");
  if (!address || extra.length > 0) return false;
  const family = isIP(address);
  if (family === 0) return false;
  if (prefixText === undefined) return true;
  if (!/^\d+$/.test(prefixText)) return false;
  const prefix = Number(prefixText);
  return prefix >= 0 && prefix <= (family === 4 ? 32 : 128);
}

function ipV4Value(address: string) {
  const parts = address.split(".").map(Number);
  return {
    family: 4,
    bits: 32,
    value: parts.reduce((value, part) => (value << 8n) | BigInt(part), 0n),
  };
}

function normalizeIpv4Tail(address: string): string | null {
  let normalized = address.toLowerCase();
  const lastColon = normalized.lastIndexOf(":");
  const ipv4Tail = normalized.slice(lastColon + 1);
  if (ipv4Tail.includes(".")) {
    if (isIP(ipv4Tail) !== 4) return null;
    const octets = ipv4Tail.split(".").map(Number);
    const firstHalf = (((octets[0] ?? 0) << 8) | (octets[1] ?? 0)).toString(16);
    const secondHalf = (((octets[2] ?? 0) << 8) | (octets[3] ?? 0)).toString(16);
    normalized = `${normalized.slice(0, lastColon + 1)}${firstHalf}:${secondHalf}`;
  }
  return normalized;
}

function expandIpv6Groups(address: string): string[] | null {
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const left = halves[0]?.length ? halves[0].split(":") : [];
  const right = halves[1]?.length ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8 || groups.some((part) => !/^[\da-f]{1,4}$/.test(part))) return null;
  return groups;
}

function ipV6Value(address: string) {
  const normalized = normalizeIpv4Tail(address);
  if (!normalized) return null;
  const groups = expandIpv6Groups(normalized);
  if (!groups) return null;
  const value = groups.reduce((current, part) => (current << 16n) | BigInt(`0x${part}`), 0n);
  return { family: 6, value, bits: 128 };
}

function ipValue(address: string) {
  const family = isIP(address);
  if (family === 4) return ipV4Value(address);
  if (family === 6) return ipV6Value(address);
  return null;
}

export function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!isValidIpCidr(cidr)) return false;
  const [networkAddress, prefixText] = cidr.trim().split("/");
  const source = ipValue(ip);
  const network = ipValue(networkAddress ?? "");
  if (!source?.family || !network?.family || source.family !== network.family) return false;
  const prefix = prefixText === undefined ? source.bits : Number(prefixText);
  const shift = BigInt(source.bits - prefix);
  return source.value >> shift === network.value >> shift;
}

export function isBreakGlassActive(expiresAt: Date | number, now = Date.now()): boolean {
  const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : expiresAt;
  return Number.isFinite(timestamp) && timestamp > now;
}

export function didSessionCountryChange(previousCountry: string, currentCountry: string): boolean {
  const previous = previousCountry.trim().toUpperCase();
  const current = currentCountry.trim().toUpperCase();
  return Boolean(previous && current && previous !== current);
}

export function isAdminLocationAllowed(
  policy: AdminLocationPolicy,
  country: string,
  ip: string | null,
  hasActiveException: boolean,
): boolean {
  return (
    policy.adminEnforcementMode === "off" ||
    policy.allowedAdminCountries.includes(country.toUpperCase()) ||
    Boolean(ip && policy.adminIpAllowlist.some((cidr) => ipMatchesCidr(ip, cidr))) ||
    hasActiveException
  );
}
