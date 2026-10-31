import { NextResponse } from "next/server";
import { z } from "zod";

import { decryptCertificateNumber } from "@/server/certificate-number";
import { db } from "@/server/firebase-admin";
import {
  createCertificateNumberHash,
  consumeVerificationBudget,
  delayFailedLookup,
  writeAuditLog,
  verifyRequestAppCheck,
} from "@/server/security";
import {
  publicVerificationOutcome,
  isPubliclyDownloadableStatus,
} from "@/shared/certificate-lifecycle";

import type { NextRequest} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  certificateNumber: z.string().trim().min(1).max(80),
  session: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  turnstileToken: z.string().min(1).max(4096),
});
const failed = { valid: false, message: "No matching certificate found" };
type VerificationResponse =
  | typeof failed
  | {
      valid: true;
      message: "Valid certificate";
      certificateType: string;
      session: string;
      issueDate: string;
      schoolName: string;
      studentName: string;
      verifiedOn: string;
    }
  | {
      valid: false;
      status: "superseded";
      message: string;
      newCertificateNumber: string;
    }
  | { valid: false; status: "revoked"; message: string };
function response(
  body: VerificationResponse | ReturnType<typeof publicVerificationOutcome>,
) {
  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Pragma: "no-cache",
    },
  });
}
async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  try {
    const payload = new URLSearchParams({ secret, response: token });
    if (remoteIp) payload.set("remoteip", remoteIp);
    const result = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: payload,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!result.ok) return false;
    const data: unknown = await result.json();
    return (
      typeof data === "object" &&
      data !== null &&
      "success" in data &&
      data.success === true
    );
  } catch {
    return false;
  }
}
function maskStudentName(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts
    .map((part) =>
      part.length <= 1
        ? `${part[0] ?? ""}*`
        : `${part[0]}${"*".repeat(Math.max(3, part.length - 1))}`,
    )
    .join(" ");
}
async function audit(request: NextRequest, outcome: string): Promise<void> {
  await writeAuditLog(request, "public", "certificate.verify", outcome).catch(
    () => { console.error("Certificate verification audit write failed"); },
  );
}
export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    const body: unknown = await request.json().catch(() => null);
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      const allowed = await consumeVerificationBudget(request);
      await audit(request, allowed ? "invalid_request" : "rate_limited");
      await delayFailedLookup();
      return response(failed);
    }
    const input = parsed.data;
    const hash = createCertificateNumberHash(input.certificateNumber);
    if (!(await consumeVerificationBudget(request, hash))) {
      await audit(request, "rate_limited");
      await delayFailedLookup();
      return response(failed);
    }
    const remoteIp = request.headers.get("cf-connecting-ip") ?? null;
    if (!(await verifyTurnstile(input.turnstileToken, remoteIp))) {
      await audit(request, "turnstile_failed");
      await delayFailedLookup();
      return response(failed);
    }
    const index = await db.collection("certificateNumberIndex").doc(hash).get();
    if (!index.exists) {
      await audit(request, "no_match");
      await delayFailedLookup();
      return response(failed);
    }
    const indexedSession = String(index.get("session") ?? "");
    if (input.session && input.session !== indexedSession) {
      await audit(request, "no_match");
      await delayFailedLookup();
      return response(failed);
    }
    const certificateId = String(index.get("certificateId") ?? "");
    if (!certificateId) {
      await audit(request, "no_match");
      await delayFailedLookup();
      return response(failed);
    }
    const certificateRef = db.collection("certificates").doc(certificateId);
    const certificate = await certificateRef.get();
    if (!certificate.exists) {
      await audit(request, "no_match");
      await delayFailedLookup();
      return response(failed);
    }
    const studentId = String(certificate.get("studentId") ?? "");
    const student = studentId
      ? await db.collection("students").doc(studentId).get()
      : null;
    if (!student?.exists || student.get("erasurePending") === true) {
      await audit(request, "no_match");
      await delayFailedLookup();
      return response(failed);
    }
    const lifecycleStatus = String(certificate.get("status") ?? "");
    if (lifecycleStatus === "superseded") {
      const newerId = String(certificate.get("supersededBy") ?? "");
      const newer = newerId
        ? await db.collection("certificates").doc(newerId).get()
        : null;
      const outcome = publicVerificationOutcome(
        "superseded",
        newer?.exists
          ? decryptCertificateNumber(newer.get("certificateNumberEncrypted"))
          : "",
      );
      if (outcome.status === "not-found") {
        await audit(request, "no_match");
        await delayFailedLookup();
        return response(failed);
      }
      await audit(request, "superseded");
      return response(outcome);
    }
    if (lifecycleStatus === "revoked") {
      await audit(request, "revoked");
      return response(publicVerificationOutcome("revoked"));
    }
    if (
      !isPubliclyDownloadableStatus(lifecycleStatus) ||
      certificate.get("published") === false
    ) {
      await audit(request, "no_match");
      await delayFailedLookup();
      return response(failed);
    }
    const studentName = String(student.get("studentName") ?? "");
    const certificateType = String(certificate.get("type") ?? "");
    const session = String(certificate.get("session") ?? "");
    const issueDate = String(certificate.get("issueDate") ?? "");
    if (!studentName || !certificateType || !session || !issueDate) {
      await audit(request, "no_match");
      await delayFailedLookup();
      return response(failed);
    }
    await audit(request, "valid");
    return response({
      valid: true,
      message: "Valid certificate",
      certificateType,
      session,
      issueDate,
      schoolName:
        String(
          (await db.collection("siteSettings").doc("main").get()).get("schoolName") ?? "",
        ).trim() || "Satyam International School",
      studentName: maskStudentName(studentName),
      verifiedOn: new Date().toISOString(),
    });
  } catch {
    await audit(request, "internal_error");
    await delayFailedLookup();
    return response(failed);
  }
}
