import type { NextRequest } from "next/server";

const GOOGLE_TRANSLATE_BASE = "https://translation.googleapis.com/language/translate/v2";
const requestCounts = new Map<string, { count: number; expiresAt: number }>();

export function translationApiKey(): string | null {
  return process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY?.trim() || null;
}

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === request.nextUrl.origin;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === request.nextUrl.origin;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

export function allowTranslationRequest(request: NextRequest): boolean {
  if (!isSameOriginRequest(request)) return false;
  const ip =
    request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local";
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || entry.expiresAt <= now) {
    requestCounts.set(ip, { count: 1, expiresAt: now + 60_000 });
    if (requestCounts.size > 5000) {
      for (const [key, value] of requestCounts) {
        if (value.expiresAt <= now) requestCounts.delete(key);
      }
    }
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count += 1;
  return true;
}

export function googleTranslateUrl(key: string): string {
  const url = new URL(GOOGLE_TRANSLATE_BASE);
  url.searchParams.set("key", key);
  return url.toString();
}
