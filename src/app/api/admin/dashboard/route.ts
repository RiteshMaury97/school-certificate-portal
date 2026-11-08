import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { getR2StorageBytes } from "@/server/r2";
import { apiError, requireAdmin } from "@/server/security";
import { getAdminUploadUsage, getUploadsToday } from "@/server/upload-policy";
import { normalizeAcademicSession } from "@/shared/academic-session";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionAliases(session: string): string[] {
  const normalized = normalizeAcademicSession(session);
  if (!normalized) return [];
  const [start] = normalized.split("-");
  return [normalized, `${start}-${String(Number(start) + 1)}`];
}

async function alertStorageBudget(storageBytes: number, budget: number): Promise<void> {
  if (storageBytes < budget * 0.8) return;
  const alertRef = db.collection("abuseCounters").doc("r2_storage_80_alert");
  const shouldSend = await db.runTransaction(async (tx) => {
    const alert = await tx.get(alertRef);
    if (alert.get("sent") === true || alert.get("sending") === true) return false;
    tx.set(
      alertRef,
      {
        sending: true,
        date: new Date().toISOString().slice(0, 10),
        bytes: storageBytes,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });
  if (!shouldSend) return;
  const superadmins = await db
    .collection("admins")
    .where("role", "==", "superadmin")
    .where("status", "==", "active")
    .limit(10)
    .get();
  const recipients = superadmins.docs
    .map((doc) => String(doc.get("email") ?? "").trim())
    .filter(Boolean);
  if (!recipients.length) {
    await alertRef.set({ sending: false }, { merge: true });
    return;
  }
  try {
    await sendMail({
      to: recipients,
      subject: "R2 storage budget reached 80%",
      text: `R2 storage is ${String(storageBytes)} bytes of a ${String(budget)} byte configured budget.`,
    });
    await alertRef.set(
      { sent: true, sending: false, sentAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    await alertRef.set({ sending: false }, { merge: true });
    console.error("R2 storage alert email failed", error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const [
      counters,
      totalStudents,
      totalCertificates,
      pending,
      openTickets,
      reviewingTickets,
      week,
      sessions,
      feedbackPositive,
      feedbackNegative,
      storageBytes,
      uploadUsage,
      uploadsToday,
    ] = await Promise.all([
      db.collection("metricsCounters").doc("portal").get(),
      db.collection("students").count().get(),
      db.collection("certificates").count().get(),
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
      getR2StorageBytes(),
      getAdminUploadUsage(admin.uid),
      getUploadsToday(),
    ]);
    const storageBudget = Number(process.env.R2_STORAGE_BUDGET_BYTES ?? 10 * 1024 * 1024 * 1024);
    await alertStorageBudget(storageBytes, storageBudget);
    const data = counters.data() ?? {};
    const configuredSessions = new Map<string, { key: string; label: string }>();
    for (const doc of sessions.docs) {
      const candidates = [doc.id, doc.get("label"), doc.get("name")];
      const normalized = candidates
        .filter((value): value is string => typeof value === "string")
        .map(normalizeAcademicSession)
        .find((value): value is string => value !== null);
      if (!normalized || configuredSessions.has(normalized)) continue;
      const label = [doc.get("label"), doc.get("name"), doc.id].find(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      );
      configuredSessions.set(normalized, { key: normalized, label: label ?? normalized });
    }
    const activityBySession = await Promise.all(
      [...configuredSessions.values()].map(async ({ key, label }) => {
        const aliases = sessionAliases(key);
        const [certificates, downloadSnapshots] = await Promise.all([
          db
            .collection("certificates")
            .where("session", "in", aliases)
            .where("status", "==", "published")
            .count()
            .get(),
          Promise.all(
            aliases.map((alias) => db.collection("certificateDownloadSessions").doc(alias).get()),
          ),
        ]);
        return {
          session: label,
          certificates: certificates.data().count,
          downloads: downloadSnapshots.reduce(
            (total, snapshot) => total + Number(snapshot.get("totalDownloads") ?? 0),
            0,
          ),
        };
      }),
    );
    const certificatesPerSession = activityBySession.map(({ session, certificates }) => ({
      session,
      count: certificates,
    }));
    const downloadsPerSession = activityBySession.map(({ session, downloads }) => ({
      session,
      downloads,
    }));
    const positive = feedbackPositive.data().count,
      negative = feedbackNegative.data().count;
    return NextResponse.json(
      {
        stats: {
          // Collection counts are authoritative; metricsCounters can be stale if an audit
          // write failed after a record was persisted.
          totalStudents: totalStudents.data().count,
          r2StorageBytes: storageBytes,
          r2StorageBudgetBytes: storageBudget,
          uploadsToday,
          remainingUploadQuotaBytes: uploadUsage.remainingQuotaBytes,
          totalCertificates: totalCertificates.data().count,
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
