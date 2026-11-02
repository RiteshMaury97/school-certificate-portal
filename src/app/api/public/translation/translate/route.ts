import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  allowTranslationRequest,
  googleTranslateUrl,
  translationApiKey,
} from "@/server/google-translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z
  .object({
    target: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/),
    texts: z.array(z.string().min(1).max(4000)).min(1).max(128),
  })
  .refine((value) => value.texts.reduce((total, text) => total + text.length, 0) <= 25_000);

export async function POST(request: NextRequest) {
  if (!allowTranslationRequest(request))
    return NextResponse.json({ error: "Translation request rejected." }, { status: 403 });
  const key = translationApiKey();
  if (!key) return NextResponse.json({ error: "translation_not_configured" }, { status: 503 });

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid translation request." }, { status: 400 });
    const response = await fetch(googleTranslateUrl(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: parsed.data.texts,
        source: "en",
        target: parsed.data.target,
        format: "text",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      return NextResponse.json({ error: "Google translation failed." }, { status: 502 });
    const payload: unknown = await response.json();
    const translated =
      typeof payload === "object" &&
      payload !== null &&
      "data" in payload &&
      typeof payload.data === "object" &&
      payload.data !== null &&
      "translations" in payload.data &&
      Array.isArray(payload.data.translations)
        ? payload.data.translations.map((item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            "translatedText" in item &&
            typeof item.translatedText === "string"
              ? item.translatedText
              : null,
          )
        : null;
    if (
      !translated ||
      translated.length !== parsed.data.texts.length ||
      translated.some((text: unknown) => text === null)
    )
      return NextResponse.json(
        { error: "Google returned an incomplete translation." },
        { status: 502 },
      );
    return NextResponse.json({ translations: translated });
  } catch {
    return NextResponse.json(
      { error: "Translation service could not be reached." },
      { status: 502 },
    );
  }
}
