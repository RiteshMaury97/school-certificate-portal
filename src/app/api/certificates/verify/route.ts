import { NextResponse } from "next/server";
import { z } from "zod";

import { decryptCertificateNumber } from "@/server/certificate-number";
import { db } from "@/server/firebase-admin";
import { requesterIp } from "@/server/request-origin";
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

import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  certificateNumber: z.string().trim().min(1).max(80),
  session: z.string().trim().regex(/^\d{4}-\d{2}$/),
  turnstileToken: z.string().min(1).max(4096),
});
const failed = { valid: false, message: "No matching certificate found" };
type VerificationResponse =
  | typeof failed
  | {
      valid: true;
      message: "Valid certificate";
      certificateType: string;
      certificateNumber: string;
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
        : `${String(part[0])}${"*".repeat(Math.max(3, part.length - 1))}`,
    )
    .join(" ");
}
async function audit(request: NextRequest, outcome: string): Promise<void> {
  await writeAuditLog(request, "public", "certificate.verify", outcome).catch(
    () => { console.error("Certificate verification audit write failed"); },
  );
}
async function failedResponse(request: NextRequest, outcome: string) {
  await audit(request, outcome);
  await delayFailedLookup();
  return response(failed);
}

async function findCertificateAndStudent(hash: string, session: string) {
  const index = await db.collection("certificateNumberIndex").doc(hash).get();
  if (!index.exists || String(index.get("session") ?? "") !== session) return null;
  const certificateId = String(index.get("certificateId") ?? "");
  if (!certificateId) return null;
  const certificate = await db.collection("certificates").doc(certificateId).get();
  if (!certificate.exists) return null;
  const studentId = String(certificate.get("studentId") ?? "");
  const student = studentId ? await db.collection("students").doc(studentId).get() : null;
  if (!student?.exists || student.get("erasurePending") === true) return null;
  return { certificate, student };
}

async function lifecycleResponse(
  request: NextRequest,
  certificate: DocumentSnapshot,
  student: DocumentSnapshot,
  input: z.infer<typeof inputSchema>,
) {
  const lifecycleStatus = String(certificate.get("status") ?? "");
  if (lifecycleStatus === "superseded") {
    const newerId = String(certificate.get("supersededBy") ?? "");
    const newer = newerId ? await db.collection("certificates").doc(newerId).get() : null;
    const outcome = publicVerificationOutcome(
      "superseded",
      newer?.exists ? decryptCertificateNumber(newer.get("certificateNumberEncrypted")) : "",
    );
    if (outcome.status === "not-found") return failedResponse(request, "no_match");
    await audit(request, "superseded");
    return response(outcome);
  }
  if (lifecycleStatus === "revoked") {
    await audit(request, "revoked");
    return response(publicVerificationOutcome("revoked"));
  }
  if (!isPubliclyDownloadableStatus(lifecycleStatus) || certificate.get("published") === false)
    return failedResponse(request, "no_match");
  return publishedCertificateResponse(request, certificate, student, input);
}

async function publishedCertificateResponse(
  request: NextRequest,
  certificate: DocumentSnapshot,
  student: DocumentSnapshot,
  input: z.infer<typeof inputSchema>,
) {
  const studentName = String(student.get("studentName") ?? "");
  const certificateType = String(certificate.get("type") ?? "");
  const session = String(certificate.get("session") ?? "");
  const issueDate = String(certificate.get("issueDate") ?? "");
  if (!studentName || !certificateType || !session || !issueDate)
    return failedResponse(request, "no_match");
  await audit(request, "valid");
  const settings = await db.collection("siteSettings").doc("main").get();
  return response({
      valid: true,
      message: "Valid certificate",
      certificateType,
      certificateNumber: input.certificateNumber,
      session,
      issueDate,
      schoolName: String(settings.get("schoolName")).trim() || "Satyam International School",
      studentName: maskStudentName(studentName),
      verifiedOn: new Date().toISOString(),
    });
}

export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const allowed = await consumeVerificationBudget(request);
      return failedResponse(request, allowed ? "invalid_request" : "rate_limited");
    }
    const input = parsed.data;
    const hash = createCertificateNumberHash(input.certificateNumber);
    if (!(await consumeVerificationBudget(request, hash)))
      return failedResponse(request, "rate_limited");
    if (!(await verifyTurnstile(input.turnstileToken, requesterIp(request))))
      return failedResponse(request, "turnstile_failed");
    const result = await findCertificateAndStudent(hash, input.session);
    if (!result) return failedResponse(request, "no_match");
    return lifecycleResponse(request, result.certificate, result.student, input);
  } catch {
    return failedResponse(request, "internal_error");
  }
}
