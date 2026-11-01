import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { apiError, requireAdmin } from "@/server/security";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const [
      counters,
      pending,
      openTickets,
      reviewingTickets,
      week,
      sessions,
      feedbackPositive,
      feedbackNegative,
      downloadSessions,
    ] = await Promise.all([
      db.collection("metricsCounters").doc("portal").get(),
      db
        .collection("certificates")
        .where("status", "==", "pending")
        .count()
        .get(),
      db
        .collection("recordReports")
        .where("status", "==", "open")
        .count()
        .get(),
      db
        .collection("recordReports")
        .where("status", "==", "reviewing")
        .count()
        .get(),
      (async () => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        const key = d.toISOString().slice(0, 10);
        const docs = await db
          .collection("metricsCounters")
          .where("date", ">=", key)
          .get();
        return docs.docs.reduce((n, x) => n + Number(x.get("count") ?? 0), 0);
      })(),
      db.collection("sessions").limit(50).get(),
      db.collection("feedback").where("helpful", "==", true).count().get(),
      db.collection("feedback").where("helpful", "==", false).count().get(),
      db.collection("certificateDownloadSessions").limit(100).get(),
    ]);
    const data = counters.data() ?? {};
    const certificatesPerSession = await Promise.all(
      sessions.docs.map(async (session) => ({
        session: session.id,
        count: (
          await db
            .collection("certificates")
            .where("session", "==", session.id)
            .where("status", "==", "published")
            .count()
            .get()
        ).data().count,
      })),
    );
    const downloadMap = new Map(
      downloadSessions.docs.map((doc) => [
        String(doc.get("session") ?? doc.id),
        Number(doc.get("totalDownloads") ?? 0),
      ]),
    );
    const allSessions = new Set([
      ...sessions.docs.map((doc) => doc.id),
      ...downloadMap.keys(),
    ]);
    const downloadsPerSession = [...allSessions]
      .sort((a, b) => b.localeCompare(a))
      .map((session) => ({
        session,
        downloads: downloadMap.get(session) ?? 0,
      }));
    const positive = feedbackPositive.data().count,
      negative = feedbackNegative.data().count;
    return NextResponse.json(
      {
        stats: {
          totalStudents: Number(data.totalStudents ?? 0),
          totalCertificates: Number(data.totalCertificates ?? 0),
          pendingApprovals: pending.data().count,
          searchesThisWeek: week,
          failedLookups: Number(data.failedLookups ?? 0),
          verificationChecks: Number(data.verificationChecks ?? 0),
          openTickets: openTickets.data().count + reviewingTickets.data().count,
          certificatesPerSession,
          downloadsPerSession,
          feedback: {
            total: positive + negative,
            helpful: positive,
            notHelpful: negative,
          },
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
