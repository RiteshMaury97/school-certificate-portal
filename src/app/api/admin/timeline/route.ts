import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/firebase-admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { apiError, requireRoles } from "@/server/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["approver"]);
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
            (b.get("timestamp")?.toMillis?.() ?? 0) -
            (a.get("timestamp")?.toMillis?.() ?? 0),
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
        events: rows.map((d) => ({
          id: d.id,
          action: d.get("action"),
          targetId: d.get("targetId"),
          actor:
            actorNames.get(String(d.get("actorUid") ?? "")) ??
            (d.get("actorUid") === "public" ? "Public user" : "System"),
          timestamp: d.get("timestamp")?.toDate?.()?.toISOString?.() ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
