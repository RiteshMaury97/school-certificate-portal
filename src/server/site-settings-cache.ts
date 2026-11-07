import "server-only";

import { unstable_cache } from "next/cache";

export const SITE_SETTINGS_TAG = "public-site-settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const getCachedSiteSettings = unstable_cache(
  async (): Promise<Record<string, unknown>> => {
    const { db } = await import("@/server/firebase-admin");
    const snapshot = await db.collection("siteSettings").doc("main").get();
    const data = snapshot.exists ? (snapshot.data() ?? {}) : {};
    const serialized = JSON.stringify(data);
    if (!serialized) return {};
    const parsed: unknown = JSON.parse(serialized);
    return isRecord(parsed) ? parsed : {};
  },
  ["public-site-settings-v1"],
  { revalidate: 60, tags: [SITE_SETTINGS_TAG] },
);
