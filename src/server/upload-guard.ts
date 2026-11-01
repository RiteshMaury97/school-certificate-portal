import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { UPLOAD_MAX_BYTES, UPLOAD_MULTIPART_ALLOWANCE_BYTES } from "@/shared/upload-limits";

export function rejectOversizedRequest(request: Request, maximum = UPLOAD_MAX_BYTES) {
  const value = request.headers.get("content-length");
  const length = value && /^\d+$/.test(value) ? Number(value) : 0;
  return length > maximum + UPLOAD_MULTIPART_ALLOWANCE_BYTES
    ? NextResponse.json({ error: "Upload request is too large." }, { status: 413 })
    : null;
}

function envLimit(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function reserveUploadQuota(adminId: string, bytes: number): Promise<void> {
  const now = Date.now();
  const hour = Math.floor(now / 3_600_000);
  const day = new Date(now).toISOString().slice(0, 10);
  const hourlyLimit = envLimit("UPLOADS_PER_HOUR_LIMIT", 60);
  const dailyLimit = envLimit("UPLOADS_PER_DAY_LIMIT", 300);
  const byteLimit = envLimit("UPLOAD_BYTES_PER_DAY_LIMIT", 200 * 1024 * 1024);
  const ref = db.collection("abuseCounters").doc(`uploads_${adminId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const hourly = Number(data.hour === hour ? data.hourCount : 0);
    const daily = Number(data.day === day ? data.dayCount : 0);
    const dailyBytes = Number(data.day === day ? data.dayBytes : 0);
    if (hourly + 1 > hourlyLimit || daily + 1 > dailyLimit || dailyBytes + bytes > byteLimit)
      throw new Error(
        `UPLOAD_QUOTA:Upload quota exceeded. Limits: ${String(hourlyLimit)} per hour, ${String(dailyLimit)} per day and ${String(Math.round(byteLimit / 1024 / 1024))} MB per day.`,
      );
    tx.set(
      ref,
      {
        hour,
        hourCount: hourly + 1,
        day,
        dayCount: daily + 1,
        dayBytes: dailyBytes + bytes,
        updatedAt: new Date(),
      },
      { merge: true },
    );
  });
}
