import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { apiError, requireRoles } from "@/server/security";

import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function timestampMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0;
}
function timestampIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["uploader", "approver", "superadmin"]);
    const studentId = request.nextUrl.searchParams.get("studentId");
    let rows: QueryDocumentSnapshot[];
    if (studentId) {
      const certificates = await db
        .collection("certificates")
        .where("studentId", "==", studentId)
        .limit(200)
        .get();
      const targetIds = [studentId, ...certificates.docs.map((doc) => doc.id)];
      const targetQueries = [];
      for (let index = 0; index < targetIds.length; index += 30) {
        targetQueries.push(
          db
            .collection("auditLogs")
            .where("targetId", "in", targetIds.slice(index, index + 30))
            .orderBy("timestamp", "desc")
            .limit(150)
            .get(),
        );
      }
      const [byStudent, ...legacy] = await Promise.all([
        db
          .collection("auditLogs")
          .where("studentId", "==", studentId)
          .orderBy("timestamp", "desc")
          .limit(150)
          .get(),
        ...targetQueries,
      ]);
      rows = [
        ...new Map(
          [
            ...byStudent.docs,
            ...legacy.flatMap((snapshot) => snapshot.docs),
          ].map((doc) => [doc.id, doc]),
        ).values(),
      ]
        .sort(
          (a, b) =>
            timestampMillis(b.get("timestamp")) - timestampMillis(a.get("timestamp")),
        )
        .slice(0, 150);
    } else {
      const snapshot = await db
        .collection("auditLogs")
        .orderBy("timestamp", "desc")
        .limit(500)
        .get();
      rows = snapshot.docs.slice(0, 150);
    }
    const actorIds = [
      ...new Set(
        rows
          .map((d) => String(d.get("actorUid") ?? ""))
          .filter((id) => id && id !== "public"),
      ),
    ].slice(0, 50);
    const actors = await Promise.all(
      actorIds.map((id) => db.collection("admins").doc(id).get()),
    );
    const actorNames = new Map(
      actors.map((d) => [d.id, String(d.get("email") ?? d.id)]),
    );
    return NextResponse.json(
      {
        events: rows.map((d) => {
          const action: unknown = d.get("action");
          const targetId: unknown = d.get("targetId");
          return {
            id: d.id,
            action,
            targetId,
            actor:
              actorNames.get(String(d.get("actorUid") ?? "")) ??
              (d.get("actorUid") === "public" ? "Public user" : "System"),
            timestamp: timestampIso(d.get("timestamp")),
          };
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
