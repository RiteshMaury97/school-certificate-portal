import { timingSafeEqual } from "node:crypto";

import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { createEncryptedExport } from "@/server/encrypted-export";
import { db } from "@/server/firebase-admin";
import {
  apiError,
  requireRoles,
  requireSensitiveReauth,
  writeAuditLog,
} from "@/server/security";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function performBackup(trigger: string, actorUid?: string) {
  const bucket = process.env.BACKUP_R2_BUCKET;
  if (!bucket || bucket === process.env.R2_BUCKET)
    throw new Error("Configure a separate BACKUP_R2_BUCKET.");
  const account = process.env.R2_ACCOUNT_ID,
    access = process.env.R2_ACCESS_KEY_ID,
    key = process.env.R2_SECRET_ACCESS_KEY;
  if (!account || !access || !key)
    throw new Error("R2 backup credentials are not configured.");
  const payload = await createEncryptedExport("json");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId: access, secretAccessKey: key },
  });
  const objectKey = `scheduled/${new Date().toISOString().replace(/[:.]/g, "-")}-portal-export.enc`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: payload,
      ContentType: "application/octet-stream",
      Metadata: { encryption: "AES-256-GCM" },
    }),
  );
  const settings = await db.collection("siteSettings").doc("main").get();
  const rotationDays = Math.max(
    7,
    Math.min(365, Number(settings.get("backupRotationDays") ?? 30)),
  );
  const cutoff = Date.now() - rotationDays * 24 * 60 * 60_000;
  let continuationToken: string | undefined;
  let purged = 0;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "scheduled/",
        ContinuationToken: continuationToken,
        MaxKeys: 500,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (
        object.Key &&
        object.Key !== objectKey &&
        object.LastModified &&
        object.LastModified.getTime() < cutoff
      ) {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }),
        );
        purged++;
      }
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);
  const log = await db
    .collection("backupLogs")
    .add({
      bucket,
      objectKey,
      encrypted: true,
      size: payload.length,
      rotationDays,
      purgedExpiredBackups: purged,
      createdAt: new Date(),
      trigger,
      actorUid: actorUid ?? null,
    });
  return {
    objectKey,
    logId: log.id,
    size: payload.length,
    purgedExpiredBackups: purged,
    rotationDays,
  };
}
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization") ?? "";
    const expected = secret ? `Bearer ${secret}` : "";
    const suppliedBuffer = Buffer.from(authorization, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (!secret || suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer))
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    return NextResponse.json({
      ok: true,
      ...(await performBackup("vercel-cron")),
    });
  } catch {
    return NextResponse.json(
      { error: "Backup failed. Check server backup configuration." },
      { status: 500 },
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    await requireSensitiveReauth(request, admin);
    const result = await performBackup("manual", admin.uid);
    await writeAuditLog(request, admin.uid, "backup.create", result.logId);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

