import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { getR2StorageUsage } from "@/server/r2";
import { apiError, requireAdmin } from "@/server/security";

import type { NextRequest } from "next/server";
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
      storage,
    ] = await Promise.all([
      db.collection("metricsCounters").doc("portal").get(),
      db.collection("certificates").where("status", "==", "pending").count().get(),
      db.collection("recordReports").where("status", "==", "open").count().get(),
      db.collection("recordReports").where("status", "==", "reviewing").count().get(),
      (async () => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        const key = d.toISOString().slice(0, 10);
        const docs = await db.collection("metricsCounters").where("date", ">=", key).get();
        return docs.docs.reduce((n, x) => n + Number(x.get("count") ?? 0), 0);
      })(),
      db.collection("sessions").limit(50).get(),
      db.collection("feedback").where("helpful", "==", true).count().get(),
      db.collection("feedback").where("helpful", "==", false).count().get(),
      db.collection("certificateDownloadSessions").limit(100).get(),
      getR2StorageUsage(),
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
    const allSessions = new Set([...sessions.docs.map((doc) => doc.id), ...downloadMap.keys()]);
    const downloadsPerSession = [...allSessions]
      .sort((a, b) => b.localeCompare(a))
      .map((session) => ({
        session,
        downloads: downloadMap.get(session) ?? 0,
      }));
    const positive = feedbackPositive.data().count,
      negative = feedbackNegative.data().count;
    const budget =
      Number(process.env.R2_STORAGE_BUDGET_BYTES) > 0
        ? Number(process.env.R2_STORAGE_BUDGET_BYTES)
        : 10_000_000_000;
    const percent = storage.bytes / budget;
    if (percent >= 0.8) {
      const alertRef = db
        .collection("abuseCounters")
        .doc(`r2_storage_alert_${new Date().toISOString().slice(0, 10)}`);
      const alert = await alertRef.get();
      if (!alert.exists) {
        const admins = await db
          .collection("admins")
          .where("role", "==", "superadmin")
          .where("status", "==", "active")
          .get();
        const emails = admins.docs.map((doc) => String(doc.get("email") ?? "")).filter(Boolean);
        if (emails.length) {
          await sendMail({
            to: emails,
            subject: "Certificate storage is above 80% of budget",
            text: `R2 storage usage is ${(storage.bytes / 1024 ** 3).toFixed(2)} GiB of ${(budget / 1024 ** 3).toFixed(2)} GiB (${(percent * 100).toFixed(1)}%).`,
          });
          await alertRef.set({ sentAt: new Date(), percent });
        }
      }
    }
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
          storage: {
            bytes: storage.bytes,
            uploadsToday: storage.uploadsToday,
            remainingBytes: Math.max(0, budget - storage.bytes),
            budgetBytes: budget,
          },
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
