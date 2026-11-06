import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";


import { removeCertificateNumberIndex } from "@/server/certificate-index";
import { db } from "@/server/firebase-admin";
import {
  ensurePublicSessions,
  rebuildPublicSessions,
} from "@/server/public-sessions";
import { softDeleteR2Object } from "@/server/r2";
import {
  createSearchKey,
  requireRoles,
  requireSensitiveReauth,
  writeAuditLog,
  apiError,
} from "@/server/security";
import {
  encryptStudentIdentifier,
  decryptStudentIdentifier,
  scholarLookupHmac,
  studentIdentifierHmac,
  studentIdentityMatches,
} from "@/server/student-pii";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { studentUpdateSchema } from "@/shared/validation";

import type { NextRequest} from "next/server";
import type { z } from "zod";
export const runtime = "nodejs";

function getChangedStudentFields(
  data: z.output<typeof studentUpdateSchema>,
  snapshot: FirebaseFirestore.DocumentSnapshot,
): string[] {
  const fieldKeys = [
    "studentName",
    "fatherName",
    "motherName",
    "admissionNumber",
    "dateOfBirth",
    "className",
    "scholarNumber",
    "session",
  ] as const;
  return fieldKeys
    .filter((key) => {
      const rawBefore: unknown = key === "admissionNumber"
        ? snapshot.get("admissionNumber") ?? snapshot.get("admissionNo")
        : snapshot.get(key);
      const storedValue = typeof rawBefore === "string" ? rawBefore : "";
      const before = ["scholarNumber", "dateOfBirth", "admissionNumber"].includes(key)
        ? storedValue ? decryptStudentIdentifier(storedValue) : ""
        : storedValue;
      return before !== data[key];
    })
    .map((key) => key === "admissionNumber" ? "admission number" : key === "dateOfBirth" ? "date of birth" : key);
}

async function validateLinkedCertificateSessions(
  studentId: string,
  requestedSession: string,
  currentSession: string,
): Promise<boolean> {
  const linked = await db.collection("certificates").where("studentId", "==", studentId).get();
  if (!linked.size || requestedSession === currentSession) return true;
  return linked.docs.every((certificate) => {
    const value: unknown = certificate.get("session");
    return normalizeAcademicSession(typeof value === "string" ? value : "") === requestedSession;
  });
}

async function hasDuplicateScholarNumber(
  studentId: string,
  data: z.output<typeof studentUpdateSchema>,
): Promise<boolean> {
  const lookupKey = scholarLookupHmac(data.scholarNumber, data.className, data.session);
  const matches = await db.collection("students").where("scholarLookupKey", "==", lookupKey).get();
  return matches.docs.some((document) => document.id !== studentId);
}

async function hasDuplicateStudentIdentity(
  studentId: string,
  searchKey: string,
  dateOfBirthKey: string,
  admissionNumberKey: string,
): Promise<{ missingDisambiguator: boolean; duplicate: boolean }> {
  const matches = await db.collection("students").where("searchKey", "==", searchKey).get();
  const others = matches.docs.filter((document) => document.id !== studentId);
  return {
    missingDisambiguator: others.length > 0 && !dateOfBirthKey && !admissionNumberKey,
    duplicate: others.some((document) =>
      studentIdentityMatches(document.data(), dateOfBirthKey, admissionNumberKey),
    ),
  };
}

async function validateStudentSessionChange(input: {
  studentId: string;
  data: z.output<typeof studentUpdateSchema>;
  snapshot: FirebaseFirestore.DocumentSnapshot;
}): Promise<NextResponse | null> {
  const { studentId, data, snapshot } = input;
  const storedSession: unknown = snapshot.get("session");
  const currentSession = normalizeAcademicSession(
    typeof storedSession === "string" ? storedSession : "",
  ) ?? "";
  const canKeepCertificateSessions = await validateLinkedCertificateSessions(
    studentId,
    normalizeAcademicSession(data.session) ?? "",
    currentSession,
  );
  if (canKeepCertificateSessions) return null;
  return NextResponse.json(
    { error: "This student has linked certificates in another session. Update the certificates to the same session before changing the student session." },
    { status: 409 },
  );
}

type StudentIdentityValidation =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      searchKey: string;
      dateOfBirth: string;
      admissionNumber: string;
      dateOfBirthKey: string;
      admissionNumberKey: string;
    };

async function validateStudentIdentity(input: {
  studentId: string;
  data: z.output<typeof studentUpdateSchema>;
  snapshot: FirebaseFirestore.DocumentSnapshot;
}): Promise<StudentIdentityValidation> {
  const { studentId, data, snapshot } = input;
  if (await hasDuplicateScholarNumber(studentId, data))
    return {
      ok: false,
      response: NextResponse.json(
        { error: "That scholar number is already assigned in this class and session." },
        { status: 409 },
      ),
    };

  const searchKey = createSearchKey(data);
  const dateOfBirth = data.dateOfBirth ?? "";
  const storedAdmission: unknown = snapshot.get("admissionNo");
  const admissionNumber = data.admissionNumber ?? (typeof storedAdmission === "string" ? storedAdmission : "");
  const dateOfBirthKey = dateOfBirth ? studentIdentifierHmac(dateOfBirth) : "";
  const admissionNumberKey = admissionNumber ? studentIdentifierHmac(admissionNumber) : "";
  const identityCheck = await hasDuplicateStudentIdentity(
    studentId,
    searchKey,
    dateOfBirthKey,
    admissionNumberKey,
  );
  if (identityCheck.missingDisambiguator || identityCheck.duplicate)
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: identityCheck.missingDisambiguator
            ? "Duplicate name combination detected: add a date of birth or admission number so students can be told apart."
            : "The supplied date of birth or admission number is already assigned to another matching student.",
        },
        { status: 409 },
      ),
    };
  return {
    ok: true,
    searchKey,
    dateOfBirth,
    admissionNumber,
    dateOfBirthKey,
    admissionNumberKey,
  };
}

async function validateStudentUpdate(
  input: {
    studentId: string;
    data: z.output<typeof studentUpdateSchema>;
    snapshot: FirebaseFirestore.DocumentSnapshot;
  },
): Promise<{ ok: false; response: NextResponse } | {
  ok: true;
  searchKey: string;
  dateOfBirth: string;
  admissionNumber: string;
  dateOfBirthKey: string;
  admissionNumberKey: string;
} > {
  const sessionError = await validateStudentSessionChange(input);
  if (sessionError) return { ok: false, response: sessionError };
  const identity = await validateStudentIdentity(input);
  if (!identity.ok) return identity;
  return identity;
}

function buildStudentUpdate(
  input: {
    data: z.output<typeof studentUpdateSchema>;
    adminUid: string;
    searchKey: string;
    scholarLookupKey: string;
    admissionNumber: string;
    dateOfBirth: string;
    dateOfBirthKey: string;
    admissionNumberKey: string;
  },
): Record<string, unknown> {
  const { data, adminUid, searchKey, scholarLookupKey, admissionNumber, dateOfBirth, dateOfBirthKey, admissionNumberKey } = input;
  const update: Record<string, unknown> = {
    studentName: data.studentName,
    fatherName: data.fatherName,
    motherName: data.motherName,
    className: data.className,
    scholarNumber: encryptStudentIdentifier(data.scholarNumber),
    scholarLookupKey,
    session: data.session,
    searchKey,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: adminUid,
  };
  if (dateOfBirth) {
    update.dateOfBirth = encryptStudentIdentifier(dateOfBirth);
    update.dateOfBirthDisambiguationKey = dateOfBirthKey;
  }
  if (admissionNumber) {
    update.admissionNumber = encryptStudentIdentifier(admissionNumber);
    update.admissionNumberDisambiguationKey = admissionNumberKey;
    update.admissionNo = FieldValue.delete();
  }
  return update;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin", "superadmin"]);
    const { studentId } = await context.params;
    const parsed = studentUpdateSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid student details." },
        { status: 400 },
      );
    const data = parsed.data;
    const ref = db.collection("students").doc(studentId);
    const snapshot = await ref.get();
    if (!snapshot.exists)
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 },
      );
    const changedFields = getChangedStudentFields(data, snapshot);
    const validation = await validateStudentUpdate({ studentId, data, snapshot });
    if (!validation.ok) return validation.response;
    const { searchKey, dateOfBirth, admissionNumber, dateOfBirthKey: dateOfBirthDisambiguationKey, admissionNumberKey: admissionNumberDisambiguationKey } = validation;
    const scholarLookupKey = scholarLookupHmac(data.scholarNumber, data.className, data.session);
    const update = buildStudentUpdate({
      data,
      adminUid: admin.uid,
      searchKey,
      scholarLookupKey,
      admissionNumber,
      dateOfBirth,
      dateOfBirthKey: dateOfBirthDisambiguationKey,
      admissionNumberKey: admissionNumberDisambiguationKey,
    });
    await ref.update(update);
    await writeAuditLog(
      request,
      admin.uid,
      "student.update",
      studentId,
      studentId,
      { changedFields },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    await requireSensitiveReauth(request, admin);
    const { studentId } = await context.params;
    const ref = db.collection("students").doc(studentId);
    const student = await ref.get();
    if (!student.exists)
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 },
      );
    const certs = await db
      .collection("certificates")
      .where("studentId", "==", studentId)
      .get();
    if (certs.docs.some((cert) => cert.get("status") === "published"))
      await ensurePublicSessions();
    for (const cert of certs.docs) {
      const r2Key = String(cert.get("r2Key") ?? "");
      if (r2Key) await softDeleteR2Object(r2Key, studentId);
      await removeCertificateNumberIndex(cert.id);
    }
    const batch = db.batch();
    for (const doc of certs.docs) batch.delete(doc.ref);
    batch.delete(ref);
    await batch.commit();
    if (certs.size > 0)
      await db
        .collection("metricsCounters")
        .doc("portal")
        .set(
          { totalCertificates: FieldValue.increment(-certs.size) },
          { merge: true },
        );
    if (certs.docs.some((cert) => cert.get("status") === "published"))
      await rebuildPublicSessions();
    await writeAuditLog(
      request,
      admin.uid,
      "student.delete",
      studentId,
      studentId,
    );
    return NextResponse.json({ ok: true, deletedCertificates: certs.size });
  } catch (error) {
    return apiError(error);
  }
}
