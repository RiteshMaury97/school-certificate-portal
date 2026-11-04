import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { decryptCertificateNumber } from "@/server/certificate-number";
import { db } from "@/server/firebase-admin";
import { requesterIp } from "@/server/request-origin";
import {
  completeDisambiguationChallenge,
  consumeDisambiguationAttempt,
  consumeSearchBudget,
  createSearchKey,
  delayFailedLookup,
  hashRequesterIp,
  issueDisambiguationChallenge,
  issueStudentAccessToken,
  recordLookupMiss,
  recordLookupSuccess,
  verifyDisambiguationChallengeToken,
  verifyRequestAppCheck,
  writeAuditLog,
  writeConsentLog,
} from "@/server/security";
import {
  classifySearchMatchCount,
  selectUniqueDisambiguationMatch,
} from "@/server/security-primitives";
import { studentIdentifierHmac } from "@/server/student-pii";
import {
  studentDisambiguationSchema,
  studentLookupSchema,
} from "@/shared/validation";

import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const genericBody = {
  found: false,
  message: "No record found. Check the details and try again.",
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function genericResponse() {
  return NextResponse.json(genericBody, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
function noStoreJson(body: Record<string, unknown>) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
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
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: payload,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return (
      typeof result === "object" &&
      result !== null &&
      "success" in result &&
      result.success === true
    );
  } catch {
    return false;
  }
}
async function audit(
  request: NextRequest,
  outcome:
    | "ambiguous"
    | "resolved"
    | "failed"
    | "success"
    | "no_match"
    | "no_certificates"
    | "turnstile_failed"
    | "internal_error"
    | "invalid_request"
    | "rate_limited",
): Promise<void> {
  await writeAuditLog(request, "public", "certificate.search", outcome).catch(
    () => { console.error("Search audit write failed"); },
  );
}
async function retrieveStudent(
  request: NextRequest,
  student: QueryDocumentSnapshot,
  session: string,
) {
  if (student.get("erasurePending") === true) {
    await recordLookupMiss(request).catch(() => null);
    await audit(request, "no_match");
    await delayFailedLookup();
    return genericResponse();
  }
  await writeConsentLog(
    request,
    process.env.PRIVACY_POLICY_VERSION ?? "2026-10",
    student.id,
  ).catch(() => null);
  // Keep this to a single-field query. A multi-field filter plus orderBy
  // requires a deployed composite index; if that index is missing Firestore
  // throws and the public privacy-safe response looks like a false no-match.
  const certificateSnapshot = await db
    .collection("certificates")
    .where("studentId", "==", student.id)
    .get();
  const active = certificateSnapshot.docs
    .filter(
      (document) =>
        document.get("session") === session &&
        document.get("status") === "published" &&
        document.get("published") !== false,
    )
    .sort((left, right) => {
      const leftCreated: unknown = left.get("createdAt");
      const rightCreated: unknown = right.get("createdAt");
      const leftTime = leftCreated instanceof Timestamp ? leftCreated.toMillis() : 0;
      const rightTime = rightCreated instanceof Timestamp ? rightCreated.toMillis() : 0;
      return rightTime - leftTime;
    });
  if (active.length === 0) {
    await recordLookupMiss(request).catch(() => { console.error("Search miss counter failed"); },
    );
    await audit(request, "no_certificates");
    await delayFailedLookup();
    return genericResponse();
  }
  await recordLookupSuccess(request).catch(() => { console.error("Search state reset failed"); },
  );
  await audit(request, "success");
  const accessToken = issueStudentAccessToken(
    student.id,
    hashRequesterIp(request),
  );
  const certificates = active
    .map((document) => {
      const data = document.data();
      return {
        certId: String(data.publicId ?? ""),
        title: String(data.type ?? "Certificate"),
        type: String(data.type ?? "Certificate"),
        session: String(data.session ?? session),
        issueDate: typeof data.issueDate === "string" ? data.issueDate : null,
        certificateNumber:
          decryptCertificateNumber(data.certificateNumberEncrypted) ||
          "Not specified",
        mimeType: String(data.mimeType ?? "application/pdf"),
      };
    })
    .filter((certificate) => certificate.certId.length >= 20);
  if (!certificates.length) {
    await audit(request, "failed");
    await delayFailedLookup();
    return genericResponse();
  }
  return noStoreJson({
    found: true,
    studentName: String(student.get("studentName")),
    className: String(student.get("className") ?? ""),
    session,
    accessToken,
    tokenExpiresIn: 300,
    certificates,
  });
}

async function failedLookup(
  request: NextRequest,
  outcome: "failed" | "no_match" | "invalid_request" | "rate_limited" | "turnstile_failed",
  consumeBudget = false,
) {
  if (consumeBudget) await consumeSearchBudget(request);
  if (outcome === "failed" || outcome === "no_match")
    await recordLookupMiss(request).catch(() => null);
  await audit(request, outcome);
  await delayFailedLookup();
  return genericResponse();
}

async function disambiguationCandidate(
  body: Record<string, unknown>,
  searchKey: string,
): Promise<QueryDocumentSnapshot | null> {
  const parsedAnswer = studentDisambiguationSchema.safeParse(body);
  if (!parsedAnswer.success) return null;
  const candidates = await db.collection("students").where("searchKey", "==", searchKey).get();
  const eligible = candidates.docs.filter((document) => document.get("erasurePending") !== true);
  if (eligible.length < 2) return null;
  const answerHash = safeIdentifierHash(parsedAnswer.data.disambiguationValue);
  if (!answerHash) return null;
  type Candidate = {
    document: QueryDocumentSnapshot;
    dateOfBirthDisambiguationKey?: unknown;
    admissionNumberDisambiguationKey?: unknown;
  };
  const selected = selectUniqueDisambiguationMatch<Candidate>(
    eligible.map((document) => ({ ...document.data(), document })),
    answerHash,
  );
  return selected?.document ?? null;
}

async function resolveChallenge(
  request: NextRequest,
  body: Record<string, unknown>,
): Promise<NextResponse | null> {
  if (typeof body.challengeToken !== "string") return null;
  const challenge = verifyDisambiguationChallengeToken(body.challengeToken, request);
  if (!challenge) return failedLookup(request, "failed", true);
  if (!(await consumeSearchBudget(request, challenge.sk)))
    return failedLookup(request, "failed");
  if (!(await consumeDisambiguationAttempt(challenge.nonce)))
    return failedLookup(request, "failed");
  const selected = await disambiguationCandidate(body, challenge.sk);
  if (!selected) return failedLookup(request, "failed");
  await completeDisambiguationChallenge(challenge.nonce);
  await audit(request, "resolved");
  return retrieveStudent(request, selected, String(selected.get("session") ?? ""));
}

async function searchStudent(
  request: NextRequest,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const parsed = studentLookupSchema.safeParse(body);
  if (!parsed.success) return failedLookup(request, "invalid_request", true);
  const input = parsed.data;
  const searchKey = createSearchKey(input);
  if (!(await consumeSearchBudget(request, searchKey)))
    return failedLookup(request, "rate_limited");
  if (!(await verifyTurnstile(input.turnstileToken, requesterIp(request))))
    return failedLookup(request, "turnstile_failed");
  const candidates = await db.collection("students").where("searchKey", "==", searchKey).get();
  const eligible = candidates.docs.filter((document) => document.get("erasurePending") !== true);
  const matchKind = classifySearchMatchCount(eligible.length);
  if (matchKind === "none") return failedLookup(request, "no_match");
  if (matchKind === "ambiguous") {
    await audit(request, "ambiguous");
    const challengeToken = issueDisambiguationChallenge(searchKey, hashRequesterIp(request));
    return noStoreJson({ needsMoreInfo: true, challengeToken });
  }
  const student = eligible.at(0);
  if (!student) return failedLookup(request, "no_match");
  return retrieveStudent(request, student, input.session);
}

export async function POST(request: NextRequest) {
  try {
    if (!requesterIp(request))
      return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
    await verifyRequestAppCheck(request);
    const raw: unknown = await request.json().catch(() => null);
    if (!isRecord(raw)) return await failedLookup(request, "invalid_request", true);
    const challengeResponse = await resolveChallenge(request, raw);
    return challengeResponse ?? (await searchStudent(request, raw));
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : error instanceof Error
          ? error.name
          : "unknown";
    console.error("[certificate.search] internal failure", { code });
    await audit(request, "internal_error");
    await delayFailedLookup();
    return genericResponse();
  }
}

function safeIdentifierHash(value: string): string | null {
  try {
    return studentIdentifierHmac(value);
  } catch {
    return null;
  }
}
