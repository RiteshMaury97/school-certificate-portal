import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/server/firebase-admin";
import { MULTIPART_ALLOWANCE_BYTES, UPLOAD_MAX_BYTES } from "@/shared/upload-limits";

export function rejectOversizedRequest(request: NextRequest, maxBytes = UPLOAD_MAX_BYTES) {
  const raw = request.headers.get("content-length");
  if (raw && /^\d+$/.test(raw) && Number(raw) > maxBytes + MULTIPART_ALLOWANCE_BYTES)
    return NextResponse.json(
      {
        error: `Upload request exceeds the ${String(Math.floor(maxBytes / 1024 / 1024))} MB limit.`,
      },
      { status: 413 },
    );
  return null;
}

export async function consumeAdminUploadQuota(uid: string, bytes: number): Promise<string | null> {
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  const limits = {
    hourly: Number(process.env.UPLOADS_PER_HOUR_LIMIT ?? 60),
    daily: Number(process.env.UPLOADS_PER_DAY_LIMIT ?? 300),
    bytes: Number(process.env.UPLOAD_BYTES_PER_DAY_LIMIT ?? 200 * 1024 * 1024),
  };
  const ref = db.collection("abuseCounters").doc(`admin_upload_${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const sameHour = snap.get("hour") === hour;
    const sameDay = snap.get("day") === day;
    const hourly = sameHour ? Number(snap.get("hourly") ?? 0) : 0;
    const daily = sameDay ? Number(snap.get("daily") ?? 0) : 0;
    const usedBytes = sameDay ? Number(snap.get("bytes") ?? 0) : 0;
    if (hourly >= limits.hourly || daily >= limits.daily || usedBytes + bytes > limits.bytes)
      return `Upload quota exceeded. Limits are ${String(limits.hourly)} uploads per hour, ${String(limits.daily)} per day, and ${String(Math.round(limits.bytes / (1024 * 1024)))} MB per day.`;
    tx.set(
      ref,
      {
        hour,
        day,
        hourly: hourly + 1,
        daily: daily + 1,
        bytes: usedBytes + bytes,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return null;
  });
}

export async function getAdminUploadUsage(uid: string) {
  const day = new Date().toISOString().slice(0, 10);
  const snap = await db.collection("abuseCounters").doc(`admin_upload_${uid}`).get();
  const used = snap.get("day") === day ? Number(snap.get("bytes") ?? 0) : 0;
  const count = snap.get("day") === day ? Number(snap.get("daily") ?? 0) : 0;
  const budget = Number(process.env.UPLOAD_BYTES_PER_DAY_LIMIT ?? 200 * 1024 * 1024);
  return {
    uploadsToday: count,
    remainingQuotaBytes: Math.max(0, budget - used),
    dailyQuotaBytes: budget,
  };
}

export async function getUploadsToday() {
  const day = new Date().toISOString().slice(0, 10);
  const snapshot = await db.collection("abuseCounters").where("day", "==", day).get();
  return snapshot.docs.reduce((total, document) => total + Number(document.get("daily") ?? 0), 0);
}
