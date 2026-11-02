import { NextResponse, type NextRequest } from "next/server";

import {
  allowTranslationRequest,
  googleTranslateUrl,
  translationApiKey,
} from "@/server/google-translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!allowTranslationRequest(request))
    return NextResponse.json({ error: "Translation request rejected." }, { status: 403 });
  const key = translationApiKey();
  if (!key) return NextResponse.json({ error: "translation_not_configured" }, { status: 503 });

  try {
    const url = new URL(googleTranslateUrl(key));
    url.pathname += "/languages";
    url.searchParams.set("target", "en");
    const response = await fetch(url, {
      cache: "force-cache",
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Google language list request failed");
    const payload: unknown = await response.json();
    const languages =
      typeof payload === "object" &&
      payload !== null &&
      "data" in payload &&
      typeof payload.data === "object" &&
      payload.data !== null &&
      "languages" in payload.data &&
      Array.isArray(payload.data.languages)
        ? payload.data.languages
            .filter(
              (item): item is { language: string; name: string } =>
                typeof item === "object" &&
                item !== null &&
                "language" in item &&
                "name" in item &&
                typeof item.language === "string" &&
                typeof item.name === "string" &&
                /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(item.language),
            )
            .map((item) => ({ code: item.language, name: item.name }))
        : [];
    if (!languages.length) throw new Error("Google returned no supported languages");
    return NextResponse.json(
      { languages },
      { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ error: "Could not load supported languages." }, { status: 502 });
  }
}
