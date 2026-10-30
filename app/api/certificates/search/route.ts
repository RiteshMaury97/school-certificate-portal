import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { db } from "@/src/lib/firebase-admin";
import { decryptCertificateNumber } from "@/src/lib/certificate-number";
import {
  studentDisambiguationSchema,
  studentLookupSchema,
} from "@/src/lib/validation";
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
} from "@/src/lib/security";
import { studentIdentifierHmac } from "@/src/lib/student-pii";
import {
  classifySearchMatchCount,
  selectUniqueDisambiguationMatch,
} from "@/src/lib/security-primitives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const genericBody = {
  found: false,
  message: "No record found. Check the details and try again.",
};
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
    | "invalid_request"
    | "rate_limited",
): Promise<void> {
  await writeAuditLog(request, "public", "certificate.search", outcome).catch(
    () => console.error("Search audit write failed"),
  );
}
async function retrieveStudent(
  request: NextRequest,
  student: QueryDocumentSnapshot,
  session: string,
) {
  if (student.get("erasurePending") === true) {
    await recordLookupMiss(request).catch(() => undefined);
    await audit(request, "no_match");
    await delayFailedLookup();
    return genericResponse();
  }
  await writeConsentLog(
    request,
    process.env.PRIVACY_POLICY_VERSION ?? "2026-10",
    student.id,
  ).catch(() => undefined);
  const certificateSnapshot = await db
    .collection("certificates")
    .where("studentId", "==", student.id)
    .where("session", "==", session)
    .where("status", "==", "published")
    .orderBy("createdAt", "desc")
    .get();
  const active = certificateSnapshot.docs.filter(
    (document) =>
      document.get("status") === "published" &&
      document.get("published") !== false,
  );
  if (active.length === 0) {
    await recordLookupMiss(request).catch(() =>
      console.error("Search miss counter failed"),
    );
    await audit(request, "no_match");
    await delayFailedLookup();
    return genericResponse();
  }
  await recordLookupSuccess(request).catch(() =>
    console.error("Search state reset failed"),
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
    session,
    accessToken,
    tokenExpiresIn: 300,
    certificates,
  });
}

export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    const raw: unknown = await request.json().catch(() => null);
    if (typeof raw !== "object" || raw === null) {
      await consumeSearchBudget(request);
      await audit(request, "invalid_request");
      await delayFailedLookup();
      return genericResponse();
    }
    const body = raw as Record<string, unknown>;

    // Second stage: the signed challenge is bound to both the original search key and requester IP.
    if (typeof body.challengeToken === "string") {
      const challenge = verifyDisambiguationChallengeToken(
        body.challengeToken,
        request,
      );
      if (!challenge) {
        await consumeSearchBudget(request);
        await audit(request, "failed");
        await recordLookupMiss(request).catch(() => undefined);
        await delayFailedLookup();
        return genericResponse();
      }
      if (!(await consumeSearchBudget(request, challenge.sk))) {
        await audit(request, "failed");
        await recordLookupMiss(request).catch(() => undefined);
        await delayFailedLookup();
        return genericResponse();
      }
      const allowed = await consumeDisambiguationAttempt(challenge.nonce);
      if (!allowed) {
        await audit(request, "failed");
        await recordLookupMiss(request).catch(() => undefined);
        await delayFailedLookup();
        return genericResponse();
      }
      const parsedAnswer = studentDisambiguationSchema.safeParse(body);
      if (!parsedAnswer.success) {
        await audit(request, "failed");
        await recordLookupMiss(request).catch(() => undefined);
        await delayFailedLookup();
        return genericResponse();
      }
      const candidateSnapshot = await db
        .collection("students")
        .where("searchKey", "==", challenge.sk)
        .get();
      const eligibleCandidates = candidateSnapshot.docs.filter(
        (document) => document.get("erasurePending") !== true,
      );
      if (eligibleCandidates.length < 2) {
        await audit(request, "failed");
        await recordLookupMiss(request).catch(() => undefined);
        await delayFailedLookup();
        return genericResponse();
      }
      const answer = parsedAnswer.data.disambiguationValue;
      const dobHash = safeIdentifierHash(answer);
      const admissionHash = safeIdentifierHash(answer);
      type Candidate = {
        document: QueryDocumentSnapshot;
        dateOfBirthDisambiguationKey?: unknown;
        admissionNumberDisambiguationKey?: unknown;
      };
      const candidates: Candidate[] = eligibleCandidates.map((document) => ({
        ...document.data(),
        document,
      }));
      const selected =
        dobHash !== null && admissionHash !== null
          ? selectUniqueDisambiguationMatch<Candidate>(candidates, dobHash)
          : null;
      if (!selected) {
        await audit(request, "failed");
        await recordLookupMiss(request).catch(() => undefined);
        await delayFailedLookup();
        return genericResponse();
      }
      await completeDisambiguationChallenge(challenge.nonce);
      await audit(request, "resolved");
      const selectedDocument = candidateSnapshot.docs.find(
        (document) => document.id === selected.document.id,
      );
      if (!selectedDocument) {
        await audit(request, "failed");
        await delayFailedLookup();
        return genericResponse();
      }
      const session = String(selectedDocument.get("session") ?? "");
      return retrieveStudent(request, selectedDocument, session);
    }

    const parsed = studentLookupSchema.safeParse(body);
    if (!parsed.success) {
      await consumeSearchBudget(request);
      await audit(request, "invalid_request");
      await delayFailedLookup();
      return genericResponse();
    }
    const input = parsed.data;
    const searchKey = createSearchKey(input);
    if (!(await consumeSearchBudget(request, searchKey))) {
      await audit(request, "rate_limited");
      await delayFailedLookup();
      return genericResponse();
    }
    const remoteIp = request.headers.get("cf-connecting-ip") ?? null;
    if (!(await verifyTurnstile(input.turnstileToken, remoteIp))) {
      await audit(request, "failed");
      await delayFailedLookup();
      return genericResponse();
    }
    const candidateSnapshot = await db
      .collection("students")
      .where("searchKey", "==", searchKey)
      .get();
    const eligibleCandidates = candidateSnapshot.docs.filter(
      (document) => document.get("erasurePending") !== true,
    );
    const matchCount = eligibleCandidates.length;
    const matchKind = classifySearchMatchCount(matchCount);
    if (matchKind === "none") {
      await recordLookupMiss(request).catch(() => undefined);
      await audit(request, "no_match");
      await delayFailedLookup();
      return genericResponse();
    }
    if (matchKind === "ambiguous") {
      await audit(request, "ambiguous");
      const challengeToken = issueDisambiguationChallenge(
        searchKey,
        hashRequesterIp(request),
      );
      return noStoreJson({ needsMoreInfo: true, challengeToken });
    }
    const studentSnapshot = { docs: eligibleCandidates };
    if (studentSnapshot.docs.length > 1) {
      await audit(request, "ambiguous");
      return noStoreJson({
        needsMoreInfo: true,
        challengeToken: issueDisambiguationChallenge(
          searchKey,
          hashRequesterIp(request),
        ),
      });
    }
    if (studentSnapshot.docs.length !== 1) {
      await recordLookupMiss(request).catch(() => undefined);
      await audit(request, "no_match");
      await delayFailedLookup();
      return genericResponse();
    }
    return retrieveStudent(request, studentSnapshot.docs[0]!, input.session);
  } catch {
    console.error("Certificate search request failed");
    await audit(request, "failed");
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
