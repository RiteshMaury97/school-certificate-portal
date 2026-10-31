"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminSession } from "@/features/auth/admin-session";
import { useTheme } from "@/features/theme/ThemeProvider";
import { appCheckHeaders, auth } from "@/lib/firebase-client";
import {
  getMultiFactorResolver,
  multiFactor,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
} from "firebase/auth";
import type { MultiFactorError, User } from "firebase/auth";
import { usePublicSiteSettings } from "@/lib/use-site-settings";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import {
  Bell,
  Sun,
  Moon,
  Monitor,
  UserRound,
  LayoutDashboard,
  Users,
  FileCheck2,
  ClipboardCheck,
  CalendarDays,
  MessageSquareWarning,
  ScrollText,
  Settings,
  ShieldCheck,
  Database,
  HelpCircle,
  FileText,
  UploadCloud,
  History,
  LockKeyhole,
  Menu,
  X,
} from "lucide-react";
import { ADMIN_IDLE_TIMEOUT_MS, ADMIN_IDLE_WARNING_MS } from "@/shared/session-policy";
type Role = "uploader" | "approver" | "superadmin";
type Student = {
  id: string;
  admissionNo?: string;
  dateOfBirth?: string;
  studentName: string;
  fatherName: string;
  motherName: string;
  session: string;
  certificateCount: number;
};
type Cert = {
  id: string;
  downloadCount?: number;
  lastDownloadedAt?: string | null;
  studentId: string;
  studentName?: string;
  fatherName?: string;
  motherName?: string;
  session: string;
  type: string;
  certificateNumber?: string;
  issueDate: string;
  fileName: string;
  mimeType?: string;
  status?: string;
  uploadedBy?: string;
  replacesId?: string | null;
  supersededBy?: string | null;
};
type Tab =
  | "help"
  | "dashboard"
  | "approvals"
  | "students"
  | "certificates"
  | "catalog"
  | "audit"
  | "rights"
  | "breaches"
  | "reports"
  | "timeline"
  | "admins"
  | "branding"
  | "announcement"
  | "faqs"
  | "retention";
const tabIcons = {
  help: HelpCircle,
  dashboard: LayoutDashboard,
  approvals: ClipboardCheck,
  students: Users,
  certificates: FileCheck2,
  catalog: CalendarDays,
  audit: ScrollText,
  rights: LockKeyhole,
  breaches: ShieldCheck,
  reports: MessageSquareWarning,
  timeline: History,
  admins: UserRound,
  branding: Settings,
  announcement: Bell,
  faqs: FileText,
  retention: Database,
} satisfies Record<Tab, typeof HelpCircle>;
const tabs: Tab[] = [
  "help",
  "dashboard",
  "approvals",
  "students",
  "certificates",
  "catalog",
  "audit",
  "rights",
  "breaches",
  "reports",
  "timeline",
  "admins",
  "branding",
  "announcement",
  "faqs",
  "retention",
];
function csrf() {
  return (
    document.cookie
      .split("; ")
      .find((x) => x.startsWith("sis_admin_csrf="))
      ?.split("=")[1] ?? ""
  );
}
export default function AdminPage() {
  const [mobileAdminNav, setMobileAdminNav] = useState(false);
  const siteSettings = usePublicSiteSettings();
  const router = useRouter();
  const pathname = usePathname();
  const { state: sessionState } = useAdminSession();
  const { theme: themeMode, toggleTheme } = useTheme();
  const routeTab: Tab = pathname.includes("/students")
    ? "students"
    : pathname.includes("/certificates")
      ? "certificates"
      : pathname.includes("/approvals")
        ? "approvals"
        : pathname.includes("/sessions")
          ? "catalog"
          : pathname.includes("/tickets")
            ? "rights"
            : pathname.includes("/audit")
              ? "audit"
              : pathname.includes("/settings")
                ? "branding"
                : pathname.includes("/admins")
                  ? "admins"
                  : pathname.includes("/backup")
                    ? "retention"
                    : "dashboard";
  const [uid, setUid] = useState("");
  const [role, setRole] = useState<Role>("uploader");
  const [email, setEmail] = useState("");
  const [tab, setTab] = useState<Tab>(routeTab);
  const [students, setStudents] = useState<Student[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [catalog, setCatalog] = useState<{ id: string; label?: string; name?: string }[]>([]);
  const [sessionOptions, setSessionOptions] = useState<
    { id: string; label?: string; name?: string }[]
  >([]);
  const [typeOptions, setTypeOptions] = useState<{ id: string; label?: string; name?: string }[]>(
    [],
  );
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [rights, setRights] = useState<Record<string, unknown>[]>([]);
  const [retentionRecords, setRetentionRecords] = useState<Record<string, unknown>[]>([]);
  const [retentionRetryJobs, setRetentionRetryJobs] = useState<Record<string, unknown>[]>([]);
  const [retentionYears, setRetentionYears] = useState("7");
  const [retentionConfirmed, setRetentionConfirmed] = useState(false);
  const [backupRotationDays, setBackupRotationDays] = useState("30");
  const [breaches, setBreaches] = useState<Record<string, unknown>[]>([]);
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [admins, setAdmins] = useState<Record<string, unknown>[]>([]);
  const [faqs, setFaqs] = useState<
    {
      questionEn: string;
      answerEn: string;
    }[]
  >([
    {
      questionEn: "Name not found",
      answerEn:
        "Check that the student's name and both parents' names match the school register, including spaces and spelling. If the record still does not appear, submit a report for review.",
    },
    {
      questionEn: "Which spelling should I use?",
      answerEn: "Use the exact spelling recorded in the school's admission or examination records.",
    },
    {
      questionEn: "Wrong details in my certificate",
      answerEn:
        "Submit a wrong-record report with the session, incorrect detail and a contact method.",
    },
    {
      questionEn: "I passed in a different session",
      answerEn:
        "Choose the session in which you passed. If it is not listed, contact the school office.",
    },
    {
      questionEn: "Is my data safe? (DPDP)",
      answerEn:
        "Your details are used to match school records and provide the requested certificate. See the Privacy page for data-rights and grievance information.",
    },
    {
      questionEn: "How do I verify a certificate as an employer?",
      answerEn:
        "Open Verify and enter the certificate number. The result confirms whether the certificate record is valid, revoked or unavailable.",
    },
    {
      questionEn: "Can I get a hard copy?",
      answerEn:
        "Contact the school office using the support details in the footer. Availability and any applicable fee are decided by the school.",
    },
  ]);
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setTab(routeTab);
  }, [routeTab]);
  const [form, setForm] = useState({
    admissionNumber: "",
    dateOfBirth: "",
    studentName: "",
    fatherName: "",
    motherName: "",
    session: "",
    certificateType: "",
    certificateNumber: "",
    issuedAt: "",
  });
  const [selectedStudent, setSelectedStudent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [csv, setCsv] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkCsv, setBulkCsv] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<
    {
      fileName: string;
      size: number;
      valid: boolean;
      errors: string[];
      mapping: Record<string, string> | null;
    }[]
  >([]);
  const [bulkProgress, setBulkProgress] = useState<Record<string, number>>({});
  const [catalogKind, setCatalogKind] = useState<"sessions" | "certificateTypes">("sessions");
  const [catalogName, setCatalogName] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditStart, setAuditStart] = useState("");
  const [auditEnd, setAuditEnd] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"uploader" | "approver" | "superadmin">("uploader");
  const [pending, setPending] = useState<Cert[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [approvalChecks, setApprovalChecks] = useState<Record<string, boolean>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, { url: string; mimeType: string }>>(
    {},
  );
  const [certificateHistory, setCertificateHistory] = useState<
    Record<string, Record<string, unknown>[]>
  >({});
  const [duplicateHashAcknowledged, setDuplicateHashAcknowledged] = useState(false);
  const [duplicateHashReason, setDuplicateHashReason] = useState("");
  const [duplicateHashWarning, setDuplicateHashWarning] = useState("");
  const [timeline, setTimeline] = useState<Record<string, unknown>[]>([]);
  const [timelineStudentId, setTimelineStudentId] = useState("");
  const [notify, setNotify] = useState({
    email: "",
    mobile: "",
    consent: false,
  });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [idleWarning, setIdleWarning] = useState(false);
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [recentLogins, setRecentLogins] = useState<Record<string, unknown>[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [announcement, setAnnouncement] = useState({
    enabled: false,
    type: "info" as "info" | "warning",
    textEn: "",
    linkUrl: "",
    startAt: "",
    endAt: "",
  });
  const [branding, setBranding] = useState<Record<string, string>>({
    schoolName: "",
    tagline: "",
    logoUrl: "",
    boardName: "",
    affiliationNumber: "",
    schoolCode: "",
    principalPhotoUrl: "",
    principalName: "",
    principalMessage: "",
    address: "",
    phone: "",
    officeHours: "",
    mapUrl: "",
    email: "",
    jurisdiction: "",
    socialLinks: "",
    grievanceOfficerName: "",
    grievanceOfficerEmail: "",
    grievanceOfficerPhone: "",
    lastUpdated: "",
    statusPageUrl: "",
    includedLanguages: "en,hi,bn,mr,gu,pa,ta,te,ur",
  });
  const obtainReauthGrant = useCallback(async (): Promise<string> => {
    const password = prompt("For this sensitive action, re-enter your administrator password:");
    if (!password) throw new Error("Re-authentication cancelled.");
    let user: User | null = null;
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      user = credential.user;
    } catch (cause) {
      const authError = cause as { code?: string };
      if (authError.code !== "auth/multi-factor-auth-required")
        throw new Error("Password verification failed.");
      const resolver = getMultiFactorResolver(auth, cause as MultiFactorError);
      const factor = resolver.hints.find(
        (item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID,
      );
      if (!factor) throw new Error("An authenticator factor is required for sensitive actions.");
      const otp = prompt("Enter the six-digit authenticator code:");
      if (!otp) throw new Error("MFA verification cancelled.");
      const credential = await resolver.resolveSignIn(
        TotpMultiFactorGenerator.assertionForSignIn(factor.uid, otp.trim()),
      );
      user = credential.user;
    }
    try {
      if (!user) throw new Error("Password and MFA verification failed.");
      const idToken = await user.getIdToken(true);
      const headers = new Headers(await appCheckHeaders());
      headers.set("Content-Type", "application/json");
      headers.set("x-csrf-token", decodeURIComponent(csrf()));
      const response = await fetch("/api/admin/reauth", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({ idToken }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || typeof result.grant !== "string")
        throw new Error("Recent password and MFA verification failed.");
      return result.grant as string;
    } finally {
      await signOut(auth).catch(() => undefined);
    }
  }, [email]);
  const api = useCallback(
    async <T extends Record<string, unknown> = Record<string, unknown>>(
      url: string,
      init: RequestInit = {},
    ): Promise<T> => {
      const method = (init.method ?? "GET").toUpperCase();
      const headers = new Headers(init.headers);
      Object.entries(await appCheckHeaders()).forEach(([key, value]) => headers.set(key, value));
      if (!["GET", "HEAD", "OPTIONS"].includes(method))
        headers.set("x-csrf-token", decodeURIComponent(csrf()));
      const options: RequestInit = {
        ...init,
        headers,
        credentials: "same-origin",
        cache: "no-store",
      };
      let response = await fetch(url, options);
      if (response.status === 428) {
        const grant = await obtainReauthGrant();
        headers.set("x-admin-reauth", grant);
        response = await fetch(url, { ...options, headers });
      }
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof data === "object" && data !== null && "error" in data
            ? String(data.error)
            : "Request failed",
        );
      return data as T;
    },
    [email, obtainReauthGrant],
  );
  const loadStudents = useCallback(async () => {
    const d = await api<{ students: Student[] }>("/api/admin/students/list");
    setStudents(d.students ?? []);
  }, [api]);
  const load = useCallback(async () => {
    if (tab === "dashboard") {
      const d = await api<{ stats: Record<string, unknown> }>("/api/admin/dashboard");
      setStats(d.stats ?? {});
    }
    if (tab === "approvals") {
      const d = await api<{ certificates: Cert[] }>("/api/admin/certificates?status=pending");
      setPending((d.certificates ?? []).filter((x) => x.status === "pending"));
    }
    if (tab === "students") {
      const [_, sessions, types] = await Promise.all([
        loadStudents(),
        api<{ items: { id: string; label?: string; name?: string }[] }>(
          "/api/admin/catalog/sessions",
        ),
        api<{ items: { id: string; label?: string; name?: string }[] }>(
          "/api/admin/catalog/certificateTypes",
        ),
      ]);
      setSessionOptions(sessions.items ?? []);
      setTypeOptions(types.items ?? []);
    }
    if (tab === "certificates") {
      const [d, sessions, types] = await Promise.all([
        api<{ certificates: Cert[] }>("/api/admin/certificates"),
        api<{ items: { id: string; label?: string; name?: string }[] }>(
          "/api/admin/catalog/sessions",
        ),
        api<{ items: { id: string; label?: string; name?: string }[] }>(
          "/api/admin/catalog/certificateTypes",
        ),
        loadStudents(),
      ]);
      setCerts(d.certificates ?? []);
      setSessionOptions(sessions.items ?? []);
      setTypeOptions(types.items ?? []);
    }
    if (tab === "catalog") {
      const d = await api<{
        items: { id: string; label?: string; name?: string }[];
      }>(`/api/admin/catalog/${catalogKind}`);
      setCatalog(d.items ?? []);
    }
    if (tab === "audit") {
      const params = new URLSearchParams();
      if (auditAction) params.set("action", auditAction);
      if (auditStart) params.set("start", new Date(auditStart).toISOString());
      if (auditEnd) params.set("end", new Date(auditEnd + "T23:59:59").toISOString());
      const d = await api<{ logs: Record<string, unknown>[] }>(
        `/api/admin/audit?${params.toString()}`,
      );
      setLogs(d.logs ?? []);
    }
    if (tab === "rights") {
      const d = await api<{ requests: Record<string, unknown>[] }>("/api/admin/rights?status=open");
      setRights(d.requests ?? []);
    }
    if (tab === "retention" && role === "superadmin") {
      const d = await api<{
        records: Record<string, unknown>[];
        retryJobs: Record<string, unknown>[];
      }>("/api/admin/retention-review");
      setRetentionRecords(d.records ?? []);
      setRetentionRetryJobs(d.retryJobs ?? []);
    }
    if (tab === "breaches") {
      const d = await api<{ breaches: Record<string, unknown>[] }>("/api/admin/breaches");
      setBreaches(d.breaches ?? []);
    }
    if (tab === "reports") {
      const d = await api<{ reports: Record<string, unknown>[] }>("/api/admin/reports");
      setReports(d.reports ?? []);
    }
    if (tab === "timeline") {
      const d = await api<{ events: Record<string, unknown>[] }>(
        `/api/admin/timeline${timelineStudentId ? `?studentId=${encodeURIComponent(timelineStudentId)}` : ""}`,
      );
      setTimeline(d.events ?? []);
    }
    if (tab === "faqs" && role === "superadmin") {
      const d = await api<{
        faqs: {
          questionEn: string;
          answerEn: string;
        }[];
      }>("/api/admin/faqs");
      if (d.faqs?.length) setFaqs(d.faqs);
    }
    if (tab === "admins" && role === "superadmin") {
      const d = await api<{ admins: Record<string, unknown>[] }>("/api/admin/users");
      setAdmins(d.admins ?? []);
    }
    if (tab === "branding" && role === "superadmin") {
      const d = await api<{ settings: Record<string, unknown> }>("/api/admin/site-settings");
      const x = d.settings ?? {};
      setMaintenanceMode(x.maintenanceMode === true);
      setRetentionYears(String(x.retentionYears ?? 7));
      setRetentionConfirmed(x.retentionScheduleConfirmed === true);
      setBackupRotationDays(String(x.backupRotationDays ?? 30));
      setBranding((v) => ({
        ...v,
        ...Object.fromEntries(
          Object.keys(v).map((k) => [
            k,
            k === "socialLinks"
              ? Array.isArray(x[k])
                ? (x[k] as { label: string; url: string }[])
                    .map((a) => `${a.label}|${a.url}`)
                    .join("\n")
                : ""
              : String(x[k] ?? ""),
          ]),
        ),
      }));
    }
    if (tab === "announcement" && (role === "superadmin" || role === "approver")) {
      const d = await api<{ announcement: Record<string, unknown> }>("/api/admin/announcements");
      const a = d.announcement ?? {};
      const local = (value: unknown) => {
        if (typeof value !== "string" || !value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      };
      setAnnouncement({
        enabled: a.enabled === true,
        type: a.type === "warning" ? "warning" : "info",
        textEn: String(a.textEn ?? ""),
        linkUrl: String(a.linkUrl ?? ""),
        startAt: local(a.startAt),
        endAt: local(a.endAt),
      });
    }
  }, [
    tab,
    api,
    loadStudents,
    catalogKind,
    auditAction,
    auditStart,
    auditEnd,
    role,
    timelineStudentId,
  ]);
  const logout = useCallback(async () => {
    try {
      await fetch("/api/admin/session", {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
    } catch {
      /* Clear the local route even when the network is unavailable. */
    }
    router.push("/admin/login");
  }, [router]);
  useEffect(() => {
    // Identity comes from the shared, server-verified session (see AdminGate).
    if (sessionState.status !== "authenticated") return;
    setUid(sessionState.admin.uid);
    setEmail(sessionState.admin.email);
    setRole(sessionState.admin.role);
  }, [sessionState]);
  useEffect(() => {
    if (email) {
      setBusy(true);
      load()
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    }
  }, [email, load]);
  useEffect(() => {
    if (!email) return;
    let lastActivity = Date.now(),
      lastScheduled = 0,
      warningTimer: ReturnType<typeof setTimeout> | undefined,
      logoutTimer: ReturnType<typeof setTimeout> | undefined,
      pingTimer: ReturnType<typeof setInterval> | undefined,
      hardExpiryTimer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (warningTimer) clearTimeout(warningTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
    };
    const schedule = () => {
      clear();
      setIdleWarning(false);
      lastActivity = Date.now();
      lastScheduled = lastActivity;
      warningTimer = setTimeout(() => setIdleWarning(true), ADMIN_IDLE_WARNING_MS);
      logoutTimer = setTimeout(() => {
        void logout();
      }, ADMIN_IDLE_TIMEOUT_MS);
    };
    const activity = () => {
      lastActivity = Date.now();
      if (Date.now() - lastScheduled > 5_000) schedule();
    };
    const externalActivity = () => schedule();
    const events = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener("sis-session-activity", externalActivity);
    schedule();
    const refreshSession = async () => {
      const headers = await appCheckHeaders();
      const response = await fetch("/api/admin/session", {
        headers,
        cache: "no-store",
      });
      if (!response.ok) {
        await logout();
        return;
      }
      const data = (await response.json()) as { hardExpiresAt?: number };
      if (typeof data.hardExpiresAt === "number") {
        if (hardExpiryTimer) clearTimeout(hardExpiryTimer);
        hardExpiryTimer = setTimeout(
          () => {
            void logout();
          },
          Math.max(0, data.hardExpiresAt - Date.now()),
        );
      }
    };
    void refreshSession().catch(() => undefined);
    pingTimer = setInterval(() => {
      if (Date.now() - lastActivity < 20_000) {
        void refreshSession().catch(() => undefined);
      }
    }, 15_000);
    return () => {
      clear();
      if (hardExpiryTimer) clearTimeout(hardExpiryTimer);
      if (pingTimer) clearInterval(pingTimer);
      events.forEach((event) => window.removeEventListener(event, activity));
      window.removeEventListener("sis-session-activity", externalActivity);
    };
  }, [email, logout]);
  async function staySignedIn() {
    try {
      const headers = await appCheckHeaders();
      const response = await fetch("/api/admin/session", {
        headers,
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setIdleWarning(false);
      window.dispatchEvent(new Event("sis-session-activity"));
    } catch {
      await logout();
    }
  }
  async function loadSessions() {
    const d = await api<{
      sessions: Record<string, unknown>[];
      recentLogins: Record<string, unknown>[];
    }>("/api/admin/sessions");
    setSessions(d.sessions ?? []);
    setRecentLogins(d.recentLogins ?? []);
    setShowSessions(true);
  }
  async function revokeSession(sessionId: string) {
    const current = sessions.some((item) => item.sessionId === sessionId && item.current === true);
    await api("/api/admin/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (current) {
      router.push("/admin/login");
      return;
    }
    await loadSessions();
  }
  async function revokeAllSessions() {
    if (!confirm("Sign out of every device? You will need to sign in again.")) return;
    await api("/api/admin/sessions/revoke-all", { method: "POST" });
    router.push("/admin/login");
  }

  useEffect(() => {
    if (tab === "certificates" && !selectedStudent && students.length)
      setSelectedStudent(students[0]!.id);
  }, [tab, selectedStudent, students]);
  const filtered = useMemo(
    () =>
      students.filter((s) =>
        [s.admissionNo, s.studentName, s.fatherName, s.motherName, s.session]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [students, search],
  );
  const visible = filtered.slice(page * 10, page * 10 + 10);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setToast("Changes saved successfully.");
      setTimeout(() => setToast(""), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  async function addStudent(e: FormEvent) {
    e.preventDefault();
    let duplicateWarning = "";
    await act(async () => {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
      const firstFile = files.at(0);
      if (firstFile instanceof File) body.append("file", firstFile);
      body.append("parentEmail", notify.email);
      body.append("parentMobile", notify.mobile);
      body.append("notificationConsent", String(notify.consent));
      body.append("confirmDuplicateHash", String(duplicateHashAcknowledged));
      body.append("duplicateHashReason", duplicateHashReason);
      const response = await fetch("/api/admin/students", {
        method: "POST",
        body,
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.duplicateFileWarning === true)
          setDuplicateHashWarning(String(result.error ?? "Duplicate file detected."));
        throw new Error(
          typeof result.error === "string" ? result.error : "Student/certificate save failed.",
        );
      }
      duplicateWarning = typeof result.warning === "string" ? result.warning : "";
      setForm({
        admissionNumber: "",
        dateOfBirth: "",
        studentName: "",
        fatherName: "",
        motherName: "",
        session: "",
        certificateType: "",
        certificateNumber: "",
        issuedAt: "",
      });
      setNotify({ email: "", mobile: "", consent: false });
      setDuplicateHashAcknowledged(false);
      setDuplicateHashReason("");
      setDuplicateHashWarning("");
      await loadStudents();
    });
    if (duplicateWarning) setToast(duplicateWarning);
  }
  async function removeStudent(s: Student) {
    if (
      !confirm(
        `Delete ${s.studentName} and all ${s.certificateCount} linked certificate files? This cannot be undone.`,
      )
    )
      return;
    await act(async () => {
      await api(`/api/admin/students/${s.id}`, { method: "DELETE" });
      await loadStudents();
    });
  }
  async function uploadMany(e: FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !files.length) return;
    await act(async () => {
      const f = new FormData();
      f.append("studentId", selectedStudent);
      f.append("session", form.session);
      f.append("certificateType", form.certificateType);
      f.append("certificateNumber", form.certificateNumber);
      f.append("issuedAt", form.issuedAt);
      f.append("confirmDuplicateHash", String(duplicateHashAcknowledged));
      f.append("duplicateHashReason", duplicateHashReason);
      const firstFile = files[0];
      if (!(firstFile instanceof File)) throw new Error("Select a certificate file.");
      f.append("file", firstFile);
      const response = await fetch("/api/admin/certificates", {
        method: "POST",
        body: f,
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.duplicateFileWarning === true)
          setDuplicateHashWarning(String(data.error ?? "Duplicate file detected."));
        throw new Error(String(data.error ?? "Certificate upload failed."));
      }
      setFiles([]);
      setDuplicateHashAcknowledged(false);
      setDuplicateHashReason("");
      setDuplicateHashWarning("");
      await load();
    });
  }
  async function importCsv(action: "preview" | "commit") {
    if (!csv) return;
    if (action === "commit" && !confirm("Import all validated student rows now?")) return;
    await act(async () => {
      const f = new FormData();
      f.append("file", csv);
      f.append("action", action);
      const response = await fetch("/api/admin/students/import", {
        method: "POST",
        body: f,
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
      const d = await response.json();
      setPreview(d);
      if (!response.ok) throw new Error(d.error ?? "CSV import failed.");
      if (action === "commit") await loadStudents();
    });
  }
  async function previewBulk() {
    if (!bulkCsv || !bulkFiles.length) {
      setError("Select certificate files and a mapping CSV first.");
      return;
    }
    await act(async () => {
      const body = new FormData();
      body.append("mappingCsv", bulkCsv);
      body.append(
        "fileManifest",
        JSON.stringify(bulkFiles.map((file) => ({ name: file.name, size: file.size }))),
      );
      const result = await api<{
        preview: {
          fileName: string;
          size: number;
          valid: boolean;
          errors: string[];
          mapping: Record<string, string> | null;
        }[];
      }>("/api/admin/bulk-upload/preview", { method: "POST", body });
      setBulkPreview(result.preview ?? []);
      setBulkProgress({});
    });
  }
  async function commitBulk() {
    const valid = bulkPreview.filter(
      (x) => x.valid && x.mapping && bulkProgress[x.fileName] !== 100,
    );
    if (!valid.length) return;
    await act(async () => {
      const failed: string[] = [];
      for (const row of valid) {
        const file = bulkFiles.find((f) => f.name === row.fileName);
        if (!file || !row.mapping) continue;
        const body = new FormData();
        body.append("file", file);
        body.append("mapping", JSON.stringify(row.mapping));
        body.append("confirmDuplicateHash", String(duplicateHashAcknowledged));
        body.append("duplicateHashReason", duplicateHashReason);
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/admin/bulk-upload");
            void appCheckHeaders()
              .then((headers) => {
                Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
                xhr.setRequestHeader("x-csrf-token", decodeURIComponent(csrf()));
                xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable)
                    setBulkProgress((v) => ({
                      ...v,
                      [row.fileName]: Math.round((e.loaded / e.total) * 100),
                    }));
                };
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    setBulkProgress((v) => ({ ...v, [row.fileName]: 100 }));
                    resolve();
                  } else {
                    let payload: Record<string, unknown> = {};
                    try {
                      payload = JSON.parse(xhr.responseText) as Record<string, unknown>;
                    } catch {}
                    if (payload.duplicateFileWarning === true)
                      setDuplicateHashWarning(String(payload.error ?? "Duplicate file detected."));
                    reject(
                      new Error(
                        `Upload failed for ${row.fileName}: ${String(payload.error ?? xhr.responseText)}`,
                      ),
                    );
                  }
                };
                xhr.onerror = () => reject(new Error(`Network error uploading ${row.fileName}`));
                xhr.send(body);
              })
              .catch(reject);
          });
        } catch {
          failed.push(row.fileName);
          setBulkProgress((v) => ({ ...v, [row.fileName]: 0 }));
        }
      }
      if (failed.length) throw new Error(`Retry required for: ${failed.join(", ")}`);
      setBulkPreview([]);
      setBulkFiles([]);
      setBulkCsv(null);
      await load();
    });
  }
  async function saveCatalog(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      await api(`/api/admin/catalog/${catalogKind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: catalogName }),
      });
      setCatalogName("");
      await load();
    });
  }
  async function resolveRight(id: string) {
    const note = resolution[id];
    if (!note?.trim()) return;
    await act(async () => {
      await api("/api/admin/rights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolution: note }),
      });
      await load();
    });
  }
  async function saveFaqs() {
    await act(async () => {
      await api("/api/admin/faqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faqs }),
      });
    });
  }
  async function updateReport(id: string, status: "open" | "reviewing" | "resolved" | "rejected") {
    await act(async () => {
      await api("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNote: reportNotes[id] ?? "" }),
      });
      await load();
    });
  }
  async function saveBranding(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      const socialLinks = branding.socialLinks
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, ...rest] = line.split("|");
          return { label: (label ?? "").trim(), url: rest.join("|").trim() };
        });
      await api("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...branding,
          socialLinks,
          maintenanceMode,
          retentionYears: Number(retentionYears),
          retentionScheduleConfirmed: retentionConfirmed,
          backupRotationDays: Number(backupRotationDays),
        }),
      });
    });
  }
  async function saveAnnouncement(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      await api("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...announcement,
          startAt: new Date(announcement.startAt).toISOString(),
          endAt: new Date(announcement.endAt).toISOString(),
        }),
      });
      setToast("Announcement saved.");
    });
  }
  async function decideCertificate(id: string, decision: "approve" | "reject") {
    const reason = rejectReason[id] ?? "";
    if (decision === "reject" && !reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    if (decision === "approve" && !approvalChecks[id]) {
      setError("Confirm that the student details match the document before approval.");
      return;
    }
    await act(async () => {
      await api(`/api/admin/certificates/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reason,
          detailsMatch: approvalChecks[id] === true,
        }),
      });
      setApprovalChecks((v) => ({ ...v, [id]: false }));
      await load();
    });
  }
  async function loadPreview(id: string) {
    await act(async () => {
      const d = await api<{ url: string; mimeType: string }>(
        `/api/admin/certificates/${id}/preview`,
      );
      setPreviewUrls((v) => ({
        ...v,
        [id]: { url: d.url, mimeType: d.mimeType },
      }));
    });
  }
  async function loadCertificateHistory(id: string) {
    await act(async () => {
      const d = await api<{ events: Record<string, unknown>[] }>(
        `/api/admin/certificates/${id}/history`,
      );
      setCertificateHistory((v) => ({ ...v, [id]: d.events ?? [] }));
    });
  }
  async function downloadTemplate(format: "csv" | "xlsx") {
    await act(async () => {
      const response = await fetch(`/api/admin/templates?format=${format}`, {
        headers: await appCheckHeaders(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Template download failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-import-template.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  async function createBackup() {
    await act(async () => {
      const d = await api<{ objectKey: string; size: number }>("/api/admin/backup", {
        method: "POST",
      });
      setToast(`Encrypted backup saved to private R2: ${d.objectKey}`);
    });
  }
  async function exportData(format: "json" | "csv") {
    const passphrase =
      prompt(
        "Optional export passphrase (minimum 12 characters). Leave blank to use the server encryption key.",
      ) ?? "";
    if (passphrase && passphrase.length < 12) {
      setError("Passphrase must be at least 12 characters.");
      return;
    }
    await act(async () => {
      const response = await fetch("/api/admin/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
          "x-csrf-token": decodeURIComponent(csrf()),
        },
        body: JSON.stringify({ format, passphrase }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Encrypted export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `school-portal-export-${format}.enc`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  async function changeRole(uid: string, role: "uploader" | "approver" | "superadmin") {
    await act(async () => {
      await api("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, role }),
      });
      await load();
    });
  }
  async function invite(e: FormEvent) {
    e.preventDefault();
    await act(async () => {
      const d = await api("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, role: inviteRole }),
      });
      setAdminEmail("");
      alert(
        `Send both links securely to the new admin. Verify email first: ${String(d.verificationLink)}\nThen set password: ${String(d.inviteLink)}`,
      );
      await load();
    });
  }
  if (!email)
    return (
      <main id="main-content" tabIndex={-1} className="grid min-h-screen place-items-center">
        Checking secure administrator session…
      </main>
    );
  return (
    <>
      {idleWarning && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-title"
          className="fixed inset-0 z-[100] grid place-items-center bg-[var(--scrim)] p-4"
        >
          <section className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 text-[var(--text)] shadow-2xl">
            <h2 id="idle-title" className="text-xl font-bold">
              Session expiring soon
            </h2>
            <p className="mt-2 text-sm">
              You have been inactive for 13 minutes. You will be signed out after 15 minutes of
              inactivity.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => void logout()} className="rounded-lg border px-4 py-2">
                Sign out
              </button>
              <button
                onClick={() => void staySignedIn()}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-[var(--on-primary)]"
              >
                Stay signed in
              </button>
            </div>
          </section>
        </div>
      )}
      {showSessions && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sessions-title"
          className="fixed inset-0 z-[90] grid place-items-center bg-[var(--scrim)] p-4"
        >
          <section className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-[var(--surface)] p-6 text-[var(--text)]">
            <div className="flex justify-between">
              <h2 id="sessions-title" className="text-xl font-bold">
                Active sessions / recent logins
              </h2>
              <button onClick={() => setShowSessions(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {sessions.map((session, i) => (
                <div
                  key={String(session.sessionId ?? i)}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-semibold">
                      {String(session.browser ?? "Device")} ·{" "}
                      {String(session.city ?? "Unknown city")}
                      {session.country ? `, ${String(session.country)}` : ""}{" "}
                      {session.current ? "· This device" : ""}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Signed in: {String(session.createdAt ?? "Unknown")} · Last activity:{" "}
                      {String(session.lastActivityAt ?? "Unknown")}
                    </p>
                  </div>
                  {session.revoked ? (
                    <span>Revoked</span>
                  ) : (
                    <button
                      onClick={() => void revokeSession(String(session.sessionId))}
                      className="rounded-lg border px-3 py-2"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
            <h3 className="mt-6 font-semibold">Recent logins</h3>
            <div className="mt-2 space-y-2">
              {recentLogins.map((login, i) => (
                <div key={i} className="rounded-lg border p-3 text-sm">
                  <b>
                    {String(login.browser ?? "Device")} · {String(login.city ?? "Unknown city")}
                    {login.country ? `, ${String(login.country)}` : ""}
                  </b>
                  <p className="text-xs text-[var(--text-muted)]">
                    Last seen: {String(login.lastSeenAt ?? "Unknown")}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => void revokeAllSessions()}
              className="mt-5 rounded-lg bg-[var(--primary)] px-4 py-3 text-[var(--on-primary)]"
            >
              Sign out of all devices
            </button>
          </section>
        </div>
      )}
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-[var(--surface-2)]">
        <header className="bg-[var(--primary)] text-[var(--on-primary)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
            <div>
              <h1 className="text-xl font-bold">
                {siteSettings.schoolName || "Satyam International School"}
              </h1>
              <p className="text-sm text-[var(--on-primary)]">
                {email} · {role}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={mobileAdminNav ? "Close navigation" : "Open navigation"}
                title={mobileAdminNav ? "Close navigation" : "Open navigation"}
                onClick={() => setMobileAdminNav((value) => !value)}
                className="utility-icon md:hidden"
              >
                {mobileAdminNav ? <X size={18} /> : <Menu size={18} />}
              </button>
              <button
                type="button"
                aria-label="Notifications and support tickets"
                title="Notifications"
                onClick={() => router.push("/admin/tickets")}
                className="utility-icon"
              >
                <Bell size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Theme: ${themeMode}. Click to change`}
                title={`Theme: ${themeMode}`}
                className="utility-icon"
              >
                {themeMode === "system" ? (
                  <Monitor size={18} aria-hidden="true" />
                ) : themeMode === "light" ? (
                  <Sun size={18} aria-hidden="true" />
                ) : (
                  <Moon size={18} aria-hidden="true" />
                )}
              </button>
              <details className="relative">
                <summary
                  aria-label="Administrator profile menu"
                  title="Profile menu"
                  className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--on-primary)_40%,transparent)] px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <UserRound size={18} aria-hidden="true" />
                  <span className="hidden sm:inline">Profile</span>
                  <span aria-hidden="true">▾</span>
                </summary>
                <div className="absolute right-0 z-50 mt-2 min-w-56 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-2 text-[var(--text)] shadow-xl">
                  <button
                    onClick={() => void loadSessions()}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
                  >
                    Active sessions / recent logins
                  </button>
                  <button
                    onClick={() => void revokeAllSessions()}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--surface-2)]"
                  >
                    Sign out of all devices
                  </button>
                  <button
                    onClick={logout}
                    className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
                  >
                    Sign out
                  </button>
                </div>
              </details>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-5 py-7">
          <nav
            className="mb-6 hidden gap-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 md:flex lg:gap-1"
            aria-label="Admin sections"
          >
            {tabs
              .filter((t) =>
                role === "superadmin"
                  ? true
                  : role === "uploader"
                    ? ["help", "dashboard", "students", "certificates", "catalog"].includes(t)
                    : [
                        "help",
                        "dashboard",
                        "approvals",
                        "students",
                        "certificates",
                        "audit",
                        "rights",
                        "reports",
                        "timeline",
                        "announcement",
                      ].includes(t),
              )
              .map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setPage(0);
                  }}
                  className={`flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${tab === t ? "bg-[var(--primary)] text-[var(--on-primary)]" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}
                  aria-label={t === "help" ? "Help and policies" : t}
                  title={t === "help" ? "Help and policies" : t}
                >
                  {(() => {
                    const Icon = tabIcons[t];
                    return <Icon aria-hidden="true" size={17} className="shrink-0" />;
                  })()}
                  <span className="hidden text-sm capitalize lg:inline">
                    {t === "help"
                      ? "Help & policies"
                      : t === "dashboard"
                        ? "Overview"
                        : t === "approvals"
                          ? "Pending approvals"
                          : t === "catalog"
                            ? "Sessions & Types"
                            : t === "rights"
                              ? "Data rights"
                              : t === "admins"
                                ? "Admin users"
                                : t === "breaches"
                                  ? "Breach log"
                                  : t === "branding"
                                    ? "Site branding"
                                    : t === "announcement"
                                      ? "Announcement"
                                      : t === "reports"
                                        ? "Record reports"
                                        : t === "faqs"
                                          ? "FAQ editor"
                                          : t === "retention"
                                            ? "Retention review"
                                            : t}
                  </span>
                </button>
              ))}
          </nav>
          {mobileAdminNav && (
            <div
              className="fixed inset-0 z-[95] bg-[var(--scrim)] md:hidden"
              role="presentation"
              onClick={() => setMobileAdminNav(false)}
            >
              <nav
                aria-label="Mobile admin navigation"
                className="h-dvh w-[min(86vw,22rem)] overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between">
                  <strong>Admin navigation</strong>
                  <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={() => setMobileAdminNav(false)}
                    className="utility-icon"
                  >
                    <X size={18} />
                  </button>
                </div>
                {tabs
                  .filter((item) =>
                    role === "superadmin"
                      ? true
                      : role === "uploader"
                        ? ["help", "dashboard", "students", "certificates", "catalog"].includes(
                            item,
                          )
                        : [
                            "help",
                            "dashboard",
                            "approvals",
                            "students",
                            "certificates",
                            "audit",
                            "rights",
                            "reports",
                            "timeline",
                            "announcement",
                          ].includes(item),
                  )
                  .map((item) => {
                    const Icon = tabIcons[item];
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setTab(item);
                          setPage(0);
                          setMobileAdminNav(false);
                        }}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold capitalize ${tab === item ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--text)] hover:bg-[var(--surface-2)]"}`}
                      >
                        <Icon size={18} />
                        {item === "help"
                          ? "Help & policies"
                          : item === "dashboard"
                            ? "Overview"
                            : item === "catalog"
                              ? "Sessions & Types"
                              : item === "rights"
                                ? "Data rights"
                                : item}
                      </button>
                    );
                  })}
              </nav>
            </div>
          )}
          {toast && (
            <p role="status" className="mb-4 rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]">
              {toast}
            </p>
          )}
          {error && (
            <div className="mb-4">
              <ErrorState
                title="Admin data could not be loaded"
                description={error}
                onRetry={() => {
                  setError("");
                  setBusy(true);
                  void load()
                    .catch((cause) =>
                      setError(
                        cause instanceof Error ? cause.message : "Unable to reload admin data.",
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              />
            </div>
          )}
          {busy && (
            <section
              aria-label="Loading admin data"
              aria-live="polite"
              className="mb-5 grid gap-3 sm:grid-cols-3"
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4"
                >
                  <div className="h-3 w-2/3 rounded bg-[var(--surface-2)]" />
                  <div className="mt-4 h-3 w-1/2 rounded bg-[var(--surface-2)]" />
                </div>
              ))}
            </section>
          )}
          {tab === "help" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Management and operational documents</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Read these controlled documents before approving production access, handling student
                information or responding to an incident. The Markdown files are published from the
                project’s <code>docs/</code> folder.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <a
                  href="/docs/pentest-checklist.md"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border p-4 hover:bg-[var(--surface-2)]"
                >
                  <b>Penetration Test Checklist</b>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Manual security tests, automated scans, findings and sign-off.
                  </p>
                </a>
                <a
                  href="/docs/privacy-impact-review.md"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border p-4 hover:bg-[var(--surface-2)]"
                >
                  <b>Privacy Impact Review</b>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Personal data inventory, providers, access, retention, risks and DPDP checklist.
                  </p>
                </a>
                <a
                  href="/docs/disaster-recovery.md"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border p-4 hover:bg-[var(--surface-2)]"
                >
                  <b>Disaster Recovery Plan</b>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Backup, recovery roles, restore steps, contacts and restore test log.
                  </p>
                </a>
              </div>
              <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]">
                Go-live requirement: complete the penetration test, approve the privacy review, fill
                all disaster-recovery role/contact and RTO/RPO placeholders, and record one
                successful staging restore test.
              </p>
            </section>
          )}
          {tab === "dashboard" && (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  ["Total students", stats.totalStudents],
                  ["Total certificates", stats.totalCertificates],
                  ["Pending approvals", stats.pendingApprovals],
                  ["Searches this week", stats.searchesThisWeek],
                  ["Failed lookups", stats.failedLookups],
                  ["Verification checks", stats.verificationChecks],
                  ["Open support tickets", stats.openTickets],
                  [
                    "Feedback responses",
                    (stats.feedback as Record<string, unknown> | undefined)?.total ?? 0,
                  ],
                  [
                    "Helpful feedback",
                    (stats.feedback as Record<string, unknown> | undefined)?.helpful ?? 0,
                  ],
                ] as const
              ).map(([label, value]) => (
                <article key={label} className="rounded-xl border bg-[var(--surface)] p-5">
                  <p className="text-sm text-[var(--text-muted)]">{label}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">{String(value ?? 0)}</p>
                </article>
              ))}
              <article className="rounded-xl border bg-[var(--surface)] p-5 sm:col-span-2 xl:col-span-4">
                <h2 className="font-bold">Published certificates per session</h2>
                <div className="mt-3 space-y-3">
                  {(() => {
                    const series = Array.isArray(stats.certificatesPerSession)
                      ? (stats.certificatesPerSession as {
                          session: string;
                          count: number;
                        }[])
                      : [];
                    const max = Math.max(1, ...series.map((x) => x.count));
                    if (series.length === 0)
                      return (
                        <EmptyState
                          title="No data found"
                          description="No published certificate statistics are available yet."
                        />
                      );
                    return series.map((x) => (
                      <div
                        key={x.session}
                        className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-sm"
                      >
                        <b>{x.session}</b>
                        <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
                          <div
                            className="h-full rounded-full bg-[var(--text)]"
                            style={{ width: `${(x.count / max) * 100}%` }}
                          />
                        </div>
                        <span className="text-right tabular-nums">{x.count}</span>
                      </div>
                    ));
                  })()}
                </div>
              </article>
              <article className="rounded-xl border bg-[var(--surface)] p-5 sm:col-span-2 xl:col-span-4">
                <h2 className="font-bold">Certificate downloads by session</h2>
                <div className="mt-3 space-y-3">
                  {(() => {
                    const series = Array.isArray(stats.downloadsPerSession)
                      ? (stats.downloadsPerSession as {
                          session: string;
                          downloads: number;
                        }[])
                      : [];
                    const max = Math.max(1, ...series.map((x) => x.downloads));
                    return series.length ? (
                      series.map((x) => (
                        <div
                          key={x.session}
                          className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-sm"
                        >
                          <b>{x.session}</b>
                          <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-2)]">
                            <div
                              className="h-full rounded-full bg-[var(--text)]"
                              style={{ width: `${(x.downloads / max) * 100}%` }}
                            />
                          </div>
                          <span className="text-right tabular-nums">{x.downloads}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">No downloads recorded yet.</p>
                    );
                  })()}
                </div>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Counts include successful individual file and ZIP downloads, not previews or print
                  views. No downloader identity is stored.
                </p>
              </article>
              <article className="rounded-xl border bg-[var(--surface)] p-5 sm:col-span-2 xl:col-span-4">
                <h2 className="font-bold">Public feedback summary</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {String((stats.feedback as Record<string, unknown> | undefined)?.total ?? 0)}{" "}
                  responses ·{" "}
                  {String((stats.feedback as Record<string, unknown> | undefined)?.helpful ?? 0)}{" "}
                  helpful ·{" "}
                  {String((stats.feedback as Record<string, unknown> | undefined)?.notHelpful ?? 0)}{" "}
                  not helpful
                </p>
              </article>
            </section>
          )}
          {tab === "approvals" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Pending certificate approvals</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Review the original, unwatermarked upload in a private 60-second preview. The
                uploader cannot approve their own submission.
              </p>
              <div className="mt-4 space-y-4">
                {pending.map((c) => (
                  <article key={c.id} className="rounded-lg border p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                      <div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <b>
                            {c.type} · {c.session}
                          </b>
                          <span className="text-xs font-semibold text-[var(--text)]">Pending</span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <dt className="text-[var(--text-muted)]">Student</dt>
                            <dd className="font-semibold">{c.studentName || c.studentId}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">Father</dt>
                            <dd>{c.fatherName || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">Mother</dt>
                            <dd>{c.motherName || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">Certificate number</dt>
                            <dd className="font-semibold">
                              {c.certificateNumber || "Not recorded"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">Session</dt>
                            <dd>{c.session}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">Type</dt>
                            <dd>{c.type}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">Issue date</dt>
                            <dd>{c.issueDate}</dd>
                          </div>
                          <div>
                            <dt className="text-[var(--text-muted)]">Uploaded by</dt>
                            <dd>{c.uploadedBy ?? "Unknown"}</dd>
                          </div>
                        </dl>
                        {c.replacesId && (
                          <p className="mt-3 rounded bg-[var(--surface-2)] p-2 text-xs text-[var(--text)]">
                            Replacement for certificate record {c.replacesId}. The old version will
                            be superseded only after this approval.
                          </p>
                        )}
                        <label className="mt-4 block text-sm">
                          Rejection reason
                          <textarea
                            translate="no"
                            value={rejectReason[c.id] ?? ""}
                            onChange={(e) =>
                              setRejectReason((v) => ({
                                ...v,
                                [c.id]: e.target.value,
                              }))
                            }
                            rows={2}
                            className="mt-1 w-full rounded border p-2"
                            placeholder="Required only when rejecting"
                          />
                        </label>
                        <label className="mt-3 flex items-start gap-2 text-sm">
                          <input
                            translate="no"
                            type="checkbox"
                            checked={approvalChecks[c.id] === true}
                            disabled={!previewUrls[c.id]}
                            onChange={(e) =>
                              setApprovalChecks((v) => ({
                                ...v,
                                [c.id]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 h-4 w-4"
                          />
                          <span>Details match the document</span>
                        </label>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => decideCertificate(c.id, "approve")}
                            disabled={
                              busy ||
                              c.uploadedBy === uid ||
                              !previewUrls[c.id] ||
                              !approvalChecks[c.id]
                            }
                            className="rounded bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-40"
                          >
                            Approve & publish
                          </button>
                          <button
                            onClick={() => decideCertificate(c.id, "reject")}
                            disabled={busy || c.uploadedBy === uid}
                            className="rounded bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                      <div className="min-h-64 rounded-lg border bg-[var(--surface-2)] p-2">
                        <div className="mb-2 flex items-center justify-between">
                          <b className="text-sm">Document preview</b>
                          {!previewUrls[c.id] && (
                            <button
                              onClick={() => loadPreview(c.id)}
                              className="rounded border bg-[var(--surface)] px-3 py-1.5 text-xs"
                            >
                              Load 60-second preview
                            </button>
                          )}
                        </div>
                        {previewUrls[c.id] ? (
                          previewUrls[c.id].mimeType === "application/pdf" ? (
                            <iframe
                              title={`Preview ${c.fileName}`}
                              src={previewUrls[c.id].url}
                              sandbox="allow-scripts allow-same-origin"
                              referrerPolicy="no-referrer"
                              className="h-[520px] w-full rounded"
                            />
                          ) : (
                            <img
                              src={previewUrls[c.id].url}
                              alt={`Certificate preview for ${c.studentName ?? "student"}`}
                              className="max-h-[520px] max-w-full object-contain"
                            />
                          )
                        ) : (
                          <p className="grid min-h-56 place-items-center text-sm text-[var(--text-muted)]">
                            Preview is private and is not cached.
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
                {pending.length === 0 && (
                  <EmptyState
                    title="No data found"
                    description="There are no pending certificates for review."
                  />
                )}
              </div>
            </section>
          )}
          {tab === "students" && (
            <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
              {role !== "approver" && (
                <section className="rounded-xl border bg-[var(--surface)] p-5">
                  <h2 className="text-lg font-bold">Add student and certificate</h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    If the student name, parents’ names and session already exist, enter a date of
                    birth or admission number. Both values are encrypted before storage.
                  </p>
                  <form
                    id="student-create-form"
                    onSubmit={addStudent}
                    className="mt-4 grid gap-3 sm:grid-cols-2"
                  >
                    {(
                      [
                        ["admissionNumber", "Admission number"],
                        ["dateOfBirth", "Date of birth"],
                        ["studentName", "Student name"],
                        ["fatherName", "Father name"],
                        ["motherName", "Mother name"],
                        ["session", "Session (YYYY-YY)"],
                        ["certificateType", "Certificate type"],
                        ["certificateNumber", "Certificate number"],
                        ["issuedAt", "Issue date"],
                      ] as const
                    ).map(([k, l]) => (
                      <label key={k} className="text-sm font-medium">
                        {l}
                        {k === "session" ? (
                          <select
                            translate="no"
                            required
                            value={form.session}
                            onChange={(e) =>
                              setForm((v) => ({
                                ...v,
                                session: e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-lg border p-2.5"
                          >
                            <option value="">Choose session</option>
                            {sessionOptions.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.label ?? x.name ?? x.id}
                              </option>
                            ))}
                          </select>
                        ) : k === "certificateType" ? (
                          <select
                            translate="no"
                            required
                            value={form.certificateType}
                            onChange={(e) =>
                              setForm((v) => ({
                                ...v,
                                certificateType: e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-lg border p-2.5"
                          >
                            <option value="">Choose certificate type</option>
                            {typeOptions.map((x) => (
                              <option key={x.id} value={x.name ?? x.label ?? x.id}>
                                {x.name ?? x.label ?? x.id}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            translate="no"
                            required={false}
                            type={k === "issuedAt" || k === "dateOfBirth" ? "date" : "text"}
                            value={form[k]}
                            onChange={(e) => setForm((v) => ({ ...v, [k]: e.target.value }))}
                            className="mt-1 w-full rounded-lg border p-2.5"
                          />
                        )}
                      </label>
                    ))}
                    <label className="text-sm font-medium sm:col-span-2">
                      Certificate file
                      <input
                        translate="no"
                        required
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                        className="mt-1 block w-full text-sm"
                      />
                    </label>
                    <div className="sm:col-span-2 rounded-lg border border-dashed p-3">
                      <p className="text-sm font-semibold">
                        Optional parent notification (consent required)
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          translate="no"
                          type="email"
                          value={notify.email}
                          onChange={(e) => setNotify((v) => ({ ...v, email: e.target.value }))}
                          placeholder="Parent email"
                          className="rounded border p-2"
                        />
                        <input
                          translate="no"
                          value={notify.mobile}
                          onChange={(e) => setNotify((v) => ({ ...v, mobile: e.target.value }))}
                          placeholder="Mobile with country code"
                          className="rounded border p-2"
                        />
                      </div>
                      <label className="mt-2 flex items-start gap-2 text-xs text-[var(--text-muted)]">
                        <input
                          translate="no"
                          type="checkbox"
                          checked={notify.consent}
                          onChange={(e) =>
                            setNotify((v) => ({
                              ...v,
                              consent: e.target.checked,
                            }))
                          }
                        />{" "}
                        Parent/guardian has consented to receive a generic certificate-availability
                        notification. Consent is recorded with timestamp and purpose; they can opt
                        out at any time.
                      </label>
                    </div>
                    {duplicateHashWarning && (
                      <div className="sm:col-span-2 rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4">
                        <p className="font-bold text-[var(--text)]">{duplicateHashWarning}</p>
                        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                          <input
                            translate="no"
                            type="checkbox"
                            checked={duplicateHashAcknowledged}
                            onChange={(e) => setDuplicateHashAcknowledged(e.target.checked)}
                            className="h-5 w-5"
                          />{" "}
                          I confirm this is intentional
                        </label>
                        <label className="mt-2 block text-sm font-semibold text-[var(--text)]">
                          Reason
                          <textarea
                            translate="no"
                            value={duplicateHashReason}
                            onChange={(e) => setDuplicateHashReason(e.target.value)}
                            minLength={10}
                            maxLength={500}
                            rows={2}
                            className="mt-1 w-full rounded border p-2"
                          />
                        </label>
                      </div>
                    )}
                    <button
                      disabled={
                        busy ||
                        (Boolean(duplicateHashWarning) &&
                          (!duplicateHashAcknowledged || duplicateHashReason.trim().length < 10))
                      } aria-busy={busy}
                      className="rounded-lg bg-[var(--primary)] p-3 font-semibold text-[var(--on-primary)] sm:col-span-2"
                    >
                      Save student & certificate
                    </button>
                  </form>
                  <div className="mt-7 border-t pt-5">
                    <h3 className="font-semibold">Bulk import students (CSV)</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Required headers: studentName,fatherName,motherName,session. Admission number
                      and dateOfBirth are optional unless a duplicate name combination exists; then
                      provide at least one.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => downloadTemplate("csv")}
                        className="rounded border px-3 py-2 text-xs"
                      >
                        Download CSV template
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTemplate("xlsx")}
                        className="rounded border px-3 py-2 text-xs"
                      >
                        Download Excel template
                      </button>
                    </div>
                    <input
                      translate="no"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => setCsv(e.target.files?.[0] ?? null)}
                      className="mt-3 block text-sm"
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => importCsv("preview")}
                        disabled={!csv || busy}
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        Preview & validate
                      </button>
                      <button
                        onClick={() => importCsv("commit")}
                        disabled={
                          !csv ||
                          busy ||
                          !preview ||
                          Number(preview.valid) !== Number(preview.total)
                        }
                        className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)]"
                      >
                        Commit import
                      </button>
                    </div>
                    {preview && (
                      <div className="mt-2 text-sm">
                        <p>
                          Rows: {String(preview.total)} · Valid: {String(preview.valid)} · Errors:{" "}
                          {Array.isArray(preview.errors) ? preview.errors.length : 0}
                        </p>
                        {Array.isArray(preview.errors) &&
                          preview.errors.map((item, index) => (
                            <p key={index} className="mt-1 text-[var(--danger)]">
                              Row {String((item as Record<string, unknown>).row)}:{" "}
                              {String((item as Record<string, unknown>).error)}
                            </p>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-7 border-t pt-5">
                    <h3 className="font-semibold">Bulk certificate upload</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Drop up to 20 PDF/JPG/PNG files and attach a CSV with headers fileName,
                      admissionNo or studentId, session, certificateType, certificateNumber,
                      issueDate. Validate all rows before upload.
                    </p>
                    <label
                      className="mt-3 block rounded-xl border-2 border-dashed border-[var(--border)] p-5 text-center text-sm"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        setBulkFiles(Array.from(e.dataTransfer.files));
                      }}
                    >
                      Drop certificate files here or choose files
                      <input
                        translate="no"
                        className="mt-2 block w-full"
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          setBulkFiles(e.target.files ? Array.from(e.target.files) : [])
                        }
                      />
                    </label>
                    <label className="mt-3 block text-sm">
                      CSV mapping file
                      <input
                        translate="no"
                        className="mt-1 block w-full"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => setBulkCsv(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={previewBulk}
                      disabled={busy || !bulkCsv || !bulkFiles.length} aria-busy={busy}
                      className="mt-3 rounded border px-4 py-2 text-sm"
                    >
                      Validate and preview
                    </button>
                    {bulkPreview.length > 0 && (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr>
                              <th className="p-2">File</th>
                              <th className="p-2">Size</th>
                              <th className="p-2">Validation</th>
                              <th className="p-2">Progress</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkPreview.map((row) => (
                              <tr key={row.fileName} className="border-t">
                                <td className="p-2">{row.fileName}</td>
                                <td className="p-2">{Math.ceil(row.size / 1024)} KB</td>
                                <td className="p-2">
                                  {row.valid ? "Ready" : row.errors.join("; ")}
                                </td>
                                <td className="p-2">
                                  <div className="h-2 w-24 rounded bg-[var(--surface-2)]">
                                    <div
                                      className="h-2 rounded bg-[var(--text)]"
                                      style={{
                                        width: `${bulkProgress[row.fileName] ?? 0}%`,
                                      }}
                                    />
                                  </div>
                                  {bulkProgress[row.fileName] === 100
                                    ? "Complete"
                                    : `${bulkProgress[row.fileName] ?? 0}%`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {duplicateHashWarning && (
                          <div className="mt-3 rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4">
                            <p className="font-bold text-[var(--text)]">{duplicateHashWarning}</p>
                            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                              <input
                                translate="no"
                                type="checkbox"
                                checked={duplicateHashAcknowledged}
                                onChange={(e) => setDuplicateHashAcknowledged(e.target.checked)}
                                className="h-5 w-5"
                              />{" "}
                              I confirm this is intentional
                            </label>
                            <label className="mt-2 block text-sm font-semibold text-[var(--text)]">
                              Reason
                              <textarea
                                translate="no"
                                value={duplicateHashReason}
                                onChange={(e) => setDuplicateHashReason(e.target.value)}
                                minLength={10}
                                maxLength={500}
                                rows={2}
                                className="mt-1 w-full rounded border p-2"
                              />
                            </label>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={commitBulk}
                          disabled={
                            busy ||
                            !bulkPreview.some((x) => x.valid) ||
                            (Boolean(duplicateHashWarning) &&
                              (!duplicateHashAcknowledged ||
                                duplicateHashReason.trim().length < 10))
                          } aria-busy={busy}
                          className="mt-3 rounded bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
                        >
                          Commit / retry remaining uploads
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}
              <section className="rounded-xl border bg-[var(--surface)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Students</h2>
                  <input
                    translate="no"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Search students…"
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-4 space-y-3">
                  {visible.length === 0 && (
                    <EmptyState
                      title="No data found"
                      description={
                        search
                          ? "No students match your search."
                          : "There are no student records yet."
                      }
                      action={
                        role !== "approver" ? (
                          <button
                            type="button"
                            onClick={() =>
                              document
                                .getElementById("student-create-form")
                                ?.scrollIntoView({ behavior: "smooth", block: "center" })
                            }
                            className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]"
                          >
                            Add student
                          </button>
                        ) : undefined
                      }
                    />
                  )}
                  {visible.map((s) => (
                    <article
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-semibold">{s.studentName}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          Parents: {s.fatherName} / {s.motherName} · {s.session} ·{" "}
                          {s.certificateCount} certificates
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setTimelineStudentId(s.id);
                            setTab("timeline");
                          }}
                          className="rounded border px-3 py-1.5 text-xs"
                        >
                          Timeline
                        </button>
                        {role !== "approver" && (
                          <button
                            onClick={() => {
                              const studentName = prompt("Student name", s.studentName);
                              if (!studentName) return;
                              const fatherName = prompt("Father name", s.fatherName);
                              if (!fatherName) return;
                              const motherName = prompt("Mother name", s.motherName);
                              if (!motherName) return;
                              const session = prompt("Session (YYYY-YY)", s.session);
                              if (!session) return;
                              const admissionNumber =
                                prompt(
                                  "Admission number (leave blank if unavailable)",
                                  s.admissionNo ?? "",
                                ) ?? "";
                              const dateOfBirth =
                                prompt(
                                  "Date of birth (YYYY-MM-DD; leave blank if unavailable)",
                                  s.dateOfBirth ?? "",
                                ) ?? "";
                              act(async () => {
                                await api(`/api/admin/students/${s.id}`, {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    studentName,
                                    fatherName,
                                    motherName,
                                    session,
                                    admissionNumber,
                                    dateOfBirth,
                                  }),
                                });
                                await loadStudents();
                              });
                            }}
                            className="rounded border px-3 py-1.5 text-xs"
                          >
                            Edit
                          </button>
                        )}
                        {role === "superadmin" && (
                          <button
                            onClick={() => removeStudent(s)}
                            className="rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--danger)]"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((v) => v - 1)}
                    className="rounded border px-3 py-2 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span>
                    Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / 10))}
                  </span>
                  <button
                    disabled={(page + 1) * 10 >= filtered.length}
                    onClick={() => setPage((v) => v + 1)}
                    className="rounded border px-3 py-2 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </section>
            </div>
          )}
          {tab === "certificates" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Certificate management</h2>
              {role !== "approver" && (
                <form onSubmit={uploadMany} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Student
                    <select
                      translate="no"
                      required
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                      className="mt-1 w-full rounded border p-2.5"
                    >
                      <option value="">Choose student</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.studentName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Session
                    <select
                      translate="no"
                      required
                      value={form.session}
                      onChange={(e) => setForm((v) => ({ ...v, session: e.target.value }))}
                      className="mt-1 w-full rounded border p-2.5"
                    >
                      <option value="">Choose session</option>
                      {sessionOptions.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label ?? x.name ?? x.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Certificate type
                    <select
                      translate="no"
                      required
                      value={form.certificateType}
                      onChange={(e) =>
                        setForm((v) => ({
                          ...v,
                          certificateType: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border p-2.5"
                    >
                      <option value="">Choose certificate type</option>
                      {typeOptions.map((x) => (
                        <option key={x.id} value={x.name ?? x.label ?? x.id}>
                          {x.name ?? x.label ?? x.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    Certificate number
                    <input
                      translate="no"
                      required
                      value={form.certificateNumber}
                      onChange={(e) =>
                        setForm((v) => ({
                          ...v,
                          certificateNumber: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded border p-2.5"
                    />
                  </label>
                  <label className="text-sm">
                    Issue date
                    <input
                      translate="no"
                      type="date"
                      required
                      value={form.issuedAt}
                      onChange={(e) => setForm((v) => ({ ...v, issuedAt: e.target.value }))}
                      className="mt-1 w-full rounded border p-2.5"
                    />
                  </label>
                  <label className="text-sm">
                    Finished certificate file
                    <input
                      translate="no"
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                      className="mt-1 block w-full"
                    />
                  </label>
                  {duplicateHashWarning && (
                    <div className="sm:col-span-2 rounded-lg border-2 border-[var(--text)] bg-[var(--surface-2)] p-4">
                      <p className="font-bold text-[var(--text)]">{duplicateHashWarning}</p>
                      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                        <input
                          translate="no"
                          type="checkbox"
                          checked={duplicateHashAcknowledged}
                          onChange={(e) => setDuplicateHashAcknowledged(e.target.checked)}
                          className="h-5 w-5"
                        />{" "}
                        I confirm this is intentional
                      </label>
                      <label className="mt-2 block text-sm font-semibold text-[var(--text)]">
                        Reason
                        <textarea
                          translate="no"
                          value={duplicateHashReason}
                          onChange={(e) => setDuplicateHashReason(e.target.value)}
                          minLength={10}
                          maxLength={500}
                          rows={2}
                          className="mt-1 w-full rounded border p-2"
                        />
                      </label>
                    </div>
                  )}
                  <button
                    disabled={
                      busy ||
                      (Boolean(duplicateHashWarning) &&
                        (!duplicateHashAcknowledged || duplicateHashReason.trim().length < 10))
                    } aria-busy={busy}
                    className="rounded-lg bg-[var(--primary)] p-3 text-[var(--on-primary)] sm:col-span-2"
                  >
                    Upload certificate
                  </button>
                </form>
              )}
              <div className="mt-6 space-y-2">
                {certs.map((c) => (
                  <article
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <span>
                      {c.fileName} · {c.type} · {c.session} ·{" "}
                      <b className="capitalize">{c.status ?? "pending"}</b>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">
                        Downloads: {c.downloadCount ?? 0}
                        {c.lastDownloadedAt
                          ? ` · Last: ${new Date(c.lastDownloadedAt).toLocaleString()}`
                          : ""}
                      </span>
                    </span>
                    <div className="flex items-center gap-3">
                      {role !== "uploader" && c.status === "pending" && (
                        <button
                          onClick={() => {
                            const number = prompt(
                              "Enter the new unique certificate number (the existing number is stored only as a hash):",
                            );
                            if (!number) return;
                            const issueDate = prompt("Issue date (YYYY-MM-DD)", c.issueDate);
                            if (issueDate)
                              act(async () => {
                                await api(`/api/admin/certificates/${c.id}`, {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    type: c.type,
                                    certificateNumber: number,
                                    session: c.session,
                                    issueDate,
                                  }),
                                });
                                await load();
                              });
                          }}
                          className="text-[var(--text)]"
                        >
                          Edit
                        </button>
                      )}{" "}
                      {role !== "approver" && c.status === "published" && (
                        <label className="cursor-pointer text-[var(--text)]">
                          Replace certificate
                          <input
                            translate="no"
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file)
                                act(async () => {
                                  const certificateNumber = prompt(
                                    "Enter the unique certificate number for the replacement file:",
                                  );
                                  if (!certificateNumber?.trim())
                                    throw new Error("A certificate number is required.");
                                  const f = new FormData();
                                  f.append("file", file);
                                  f.append("session", c.session);
                                  f.append("type", c.type);
                                  f.append("certificateNumber", certificateNumber);
                                  f.append("issueDate", c.issueDate);
                                  f.append(
                                    "confirmDuplicateHash",
                                    String(duplicateHashAcknowledged),
                                  );
                                  f.append("duplicateHashReason", duplicateHashReason);
                                  const response = await fetch(`/api/admin/certificates/${c.id}`, {
                                    method: "PUT",
                                    body: f,
                                    headers: {
                                      "x-csrf-token": decodeURIComponent(csrf()),
                                      ...(await appCheckHeaders()),
                                    },
                                  });
                                  if (!response.ok) {
                                    const data = await response.json().catch(() => ({}));
                                    if (data.duplicateFileWarning === true)
                                      setDuplicateHashWarning(
                                        String(data.error ?? "Duplicate file detected."),
                                      );
                                    throw new Error(String(data.error ?? "Replacement failed."));
                                  }
                                  setDuplicateHashWarning("");
                                  setDuplicateHashAcknowledged(false);
                                  setDuplicateHashReason("");
                                  await load();
                                });
                            }}
                          />
                        </label>
                      )}
                      {role !== "uploader" && c.status === "published" && (
                        <button
                          onClick={() => {
                            const reason =
                              prompt(
                                "Required internal revocation reason (at least 5 characters):",
                              ) ?? "";
                            if (reason.trim().length < 5) {
                              setError("A revocation reason is required.");
                              return;
                            }
                            if (
                              confirm(
                                "Revoke this certificate? It will immediately fail public verification.",
                              )
                            )
                              act(async () => {
                                await api(`/api/admin/certificates/${c.id}/revoke`, {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ reason }),
                                });
                                await load();
                              });
                          }}
                          className="font-semibold text-[var(--text)]"
                        >
                          Revoke
                        </button>
                      )}
                      {c.status === "revoked" && (
                        <span className="font-semibold text-[var(--text)]">Revoked</span>
                      )}
                      {role !== "uploader" && (
                        <button
                          onClick={() => loadCertificateHistory(c.id)}
                          className="text-[var(--text)]"
                        >
                          History
                        </button>
                      )}
                      {role === "superadmin" && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "Delete this certificate? The original will be retained in the private soft-delete area for 30 days.",
                              )
                            )
                              act(async () => {
                                await api(`/api/admin/certificates/${c.id}`, {
                                  method: "DELETE",
                                });
                                await load();
                              });
                          }}
                          className="text-[var(--danger)]"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {Object.entries(certificateHistory).map(([id, events]) => (
                  <section key={id} className="mt-3 rounded border bg-[var(--surface-2)] p-3">
                    <b className="text-sm">History · {id}</b>
                    <ol className="mt-2 space-y-1 text-xs">
                      {(events as Record<string, unknown>[]).map((event) => (
                        <li key={String(event.id)}>
                          {String(event.action)} · {String(event.actorUid)} ·{" "}
                          {String(event.timestamp ?? "Time unavailable")}
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </section>
          )}
          {tab === "catalog" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Sessions and certificate types</h2>
              {role === "superadmin" && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <select
                    translate="no"
                    value={catalogKind}
                    onChange={(e) => setCatalogKind(e.target.value as typeof catalogKind)}
                    className="rounded border p-2"
                  >
                    <option value="sessions">Sessions</option>
                    <option value="certificateTypes">Certificate types</option>
                  </select>
                  <form onSubmit={saveCatalog} className="flex gap-2">
                    <input
                      translate="no"
                      required
                      value={catalogName}
                      onChange={(e) => setCatalogName(e.target.value)}
                      placeholder="New item name"
                      className="rounded border px-3 py-2"
                    />
                    <button className="rounded bg-[var(--primary)] px-4 text-[var(--on-primary)]">
                      Add
                    </button>
                  </form>
                </div>
              )}
              <ul className="mt-5 divide-y">
                {catalog.map((c) => (
                  <li key={c.id} className="flex justify-between py-3">
                    {c.label ?? c.name ?? c.id}
                    {role === "superadmin" && (
                      <button
                        onClick={() => {
                          if (confirm("Delete this catalog item?"))
                            act(async () => {
                              await api(`/api/admin/catalog/${catalogKind}?id=${c.id}`, {
                                method: "DELETE",
                              });
                              await load();
                            });
                        }}
                        className="text-sm text-[var(--danger)]"
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tab === "audit" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Audit logs</h2>
                <div className="flex gap-2">
                  <input
                    translate="no"
                    placeholder="Filter action"
                    value={auditAction}
                    onChange={(e) => setAuditAction(e.target.value)}
                    className="rounded border px-3 py-2"
                  />
                  <input
                    translate="no"
                    type="date"
                    value={auditStart}
                    onChange={(e) => setAuditStart(e.target.value)}
                    className="rounded border px-2 py-2"
                  />
                  <input
                    translate="no"
                    type="date"
                    value={auditEnd}
                    onChange={(e) => setAuditEnd(e.target.value)}
                    className="rounded border px-2 py-2"
                  />
                  <button onClick={() => load()} className="rounded border px-3">
                    Filter
                  </button>
                  <a
                    href={`/api/admin/audit?format=csv${auditAction ? `&action=${encodeURIComponent(auditAction)}` : ""}${auditStart ? `&start=${encodeURIComponent(new Date(auditStart).toISOString())}` : ""}${auditEnd ? `&end=${encodeURIComponent(new Date(auditEnd + "T23:59:59").toISOString())}` : ""}`}
                    className="rounded bg-[var(--primary)] px-3 py-2 text-[var(--on-primary)]"
                  >
                    Export CSV
                  </a>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {logs.map((l, i) => (
                  <article key={String(l.id ?? i)} className="rounded border p-3 text-sm">
                    <b>{String(l.action ?? "")}</b> · {String(l.timestamp ?? "")}
                    <p className="text-xs text-[var(--text-muted)]">
                      Actor: {String(l.actorUid ?? "")} · IP hash: {String(l.ipHash ?? "")}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === "rights" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Student / parent data-rights requests</h2>
              <div className="mt-4 space-y-3">
                {rights.map((r) => (
                  <article key={String(r.id)} className="rounded-lg border p-4">
                    <p className="font-semibold">
                      {String(r.requestType ?? r.type ?? "Request")} ·{" "}
                      {String(r.requesterName ?? r.name ?? "Requester")}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {String(r.description ?? r.details ?? "")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Ack: {String(r.acknowledgmentId ?? r.id)} · Contact:{" "}
                      {String(r.contactEmail ?? "No data found")} · Student:{" "}
                      {String(r.studentName ?? "")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        translate="no"
                        value={resolution[String(r.id)] ?? ""}
                        onChange={(e) =>
                          setResolution((v) => ({
                            ...v,
                            [String(r.id)]: e.target.value,
                          }))
                        }
                        placeholder="Resolution notes"
                        className="min-w-60 flex-1 rounded border px-3 py-2"
                      />
                      <button
                        onClick={() => resolveRight(String(r.id))}
                        className="rounded bg-[var(--primary)] px-4 py-2 text-[var(--on-primary)]"
                      >
                        Resolve
                      </button>
                      {r.requestType === "erasure" && role === "superadmin" && (
                        <button
                          onClick={() => {
                            const studentId = prompt(
                              "Enter the verified Firestore student record ID:",
                            );
                            if (!studentId) return;
                            const confirmText = prompt(
                              "Type ERASE to permanently erase the verified student's data:",
                            );
                            if (confirmText !== "ERASE") return;
                            const reason = prompt(
                              "Record the verified data-principal request / legal basis (minimum 10 characters):",
                            );
                            if (!reason) return;
                            void act(async () => {
                              const result = await api<{
                                acknowledgmentId: string;
                                erasureId: string;
                              }>("/api/admin/rights", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  id: String(r.id),
                                  studentId,
                                  action: "erase",
                                  confirm: "ERASE",
                                  reason,
                                }),
                              });
                              setToast(
                                `Erasure complete. Request acknowledgment: ${result.acknowledgmentId}; receipt: ${result.erasureId}`,
                              );
                              await load();
                            });
                          }}
                          className="rounded bg-[var(--primary)] px-4 py-2 text-[var(--on-primary)]"
                        >
                          Approve erasure
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === "breaches" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Personal data breach register</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Record suspected or confirmed incidents immediately. This log does not itself send
                statutory notifications; the incident lead must follow the approved notification
                procedure.
              </p>
              <button
                onClick={() => {
                  const summary = prompt("Incident summary (no unnecessary personal data)");
                  if (!summary) return;
                  const affectedData = prompt("Categories of data affected");
                  if (!affectedData) return;
                  const estimate = Number(
                    prompt("Estimated number of affected people", "0") ?? "0",
                  );
                  if (!Number.isFinite(estimate) || estimate < 0) return;
                  act(async () => {
                    await api("/api/admin/breaches", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        summary,
                        affectedData,
                        affectedPrincipalsEstimate: estimate,
                        discoveredAt: new Date().toISOString(),
                        status: "investigating",
                      }),
                    });
                    await load();
                  });
                }}
                className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
              >
                Record incident
              </button>
              <div className="mt-5 space-y-3">
                {breaches.map((b) => (
                  <article key={String(b.id)} className="rounded-lg border p-4">
                    <p className="font-semibold">{String(b.summary ?? "Incident")}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Discovered: {String(b.discoveredAt ?? "")} · Status: {String(b.status ?? "")}
                    </p>
                    <p className="text-sm">
                      Affected data: {String(b.affectedData ?? "")} · Estimated people:{" "}
                      {String(b.affectedPrincipalsEstimate ?? "")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Board initial notice: {String(b.boardNotifiedAt ?? "Not recorded")} · Board
                      detailed report: {String(b.boardDetailedReportAt ?? "Not recorded")} · People
                      notified: {String(b.principalsNotifiedAt ?? "Not recorded")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          act(async () => {
                            await api("/api/admin/breaches", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: String(b.id),
                                boardNotifiedAt: new Date().toISOString(),
                                status: "notified",
                              }),
                            });
                            await load();
                          })
                        }
                        className="rounded border px-3 py-1.5 text-xs"
                      >
                        Record Board notification
                      </button>
                      <button
                        onClick={() =>
                          act(async () => {
                            await api("/api/admin/breaches", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: String(b.id),
                                boardDetailedReportAt: new Date().toISOString(),
                                status: "notified",
                              }),
                            });
                            await load();
                          })
                        }
                        className="rounded border px-3 py-1.5 text-xs"
                      >
                        Record Board detailed report
                      </button>
                      <button
                        onClick={() =>
                          act(async () => {
                            await api("/api/admin/breaches", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: String(b.id),
                                principalsNotifiedAt: new Date().toISOString(),
                                status: "notified",
                              }),
                            });
                            await load();
                          })
                        }
                        className="rounded border px-3 py-1.5 text-xs"
                      >
                        Record affected people notified
                      </button>
                      <button
                        onClick={() =>
                          act(async () => {
                            await api("/api/admin/breaches", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: String(b.id),
                                status: "closed",
                              }),
                            });
                            await load();
                          })
                        }
                        className="rounded border px-3 py-1.5 text-xs"
                      >
                        Close incident
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === "timeline" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {timelineStudentId ? "Student activity timeline" : "Global activity timeline"}
                </h2>
                <button
                  onClick={() => setTimelineStudentId("")}
                  className="rounded border px-3 py-1 text-xs"
                >
                  Show global
                </button>
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Recent uploads, approvals, rejections, edits, revocations and public verification
                activity.
              </p>
              <ol className="mt-4 space-y-3">
                {timeline.map((e) => (
                  <li key={String(e.id)} className="flex gap-3 border-l-2 border-[var(--divider)] pl-4">
                    <div>
                      <p className="font-semibold">{String(e.action ?? "Activity")}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {String(e.actor ?? "System")} · {String(e.timestamp ?? "Time unavailable")}{" "}
                        · {String(e.targetId ?? "")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {tab === "branding" && role === "superadmin" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Public site branding</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                All public school identity, principal and contact information is read from the{" "}
                <code>siteSettings/main</code> Firestore document.
              </p>
              <form onSubmit={saveBranding} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[var(--text)]">
                  Retention period after the end of the academic session (years)
                  <input
                    translate="no"
                    type="number"
                    min="1"
                    max="30"
                    value={retentionYears}
                    onChange={(e) => setRetentionYears(e.target.value)}
                    className="mt-1 w-full rounded border p-2.5"
                  />
                </label>
                <label className="text-sm font-semibold text-[var(--text)]">
                  Encrypted backup rotation (days)
                  <input
                    translate="no"
                    type="number"
                    min="7"
                    max="365"
                    value={backupRotationDays}
                    onChange={(e) => setBackupRotationDays(e.target.value)}
                    className="mt-1 w-full rounded border p-2.5"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    translate="no"
                    type="checkbox"
                    checked={retentionConfirmed}
                    onChange={(e) => setRetentionConfirmed(e.target.checked)}
                    className="h-5 w-5"
                  />{" "}
                  I confirm this retention schedule has been reviewed against applicable
                  school/legal requirements
                </label>
                <label className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm font-semibold text-[var(--text)] sm:col-span-2">
                  <input
                    translate="no"
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="h-5 w-5"
                  />{" "}
                  Enable public maintenance mode (staff admin pages remain available)
                </label>
                {(
                  [
                    ["schoolName", "School name"],
                    ["tagline", "Tagline"],
                    ["logoUrl", "School logo HTTPS URL"],
                    ["boardName", "Board / affiliation name"],
                    ["affiliationNumber", "Affiliation number"],
                    ["schoolCode", "School code"],
                    ["principalPhotoUrl", "Principal photo HTTPS URL"],
                    ["principalName", "Principal name"],
                    ["address", "School address"],
                    ["phone", "School phone"],
                    ["officeHours", "Office hours"],
                    ["mapUrl", "Map link (HTTPS)"],
                    ["statusPageUrl", "Public system status page (HTTPS)"],
                    ["email", "School email"],
                    ["jurisdiction", "Legal jurisdiction / city"],
                    ["grievanceOfficerName", "Data Protection / Grievance Officer"],
                    ["grievanceOfficerEmail", "Officer email"],
                    ["grievanceOfficerPhone", "Officer phone"],
                    ["lastUpdated", "Last updated date (display text)"],
                    ["includedLanguages", "Google Translate language codes (comma-separated)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-sm font-semibold text-[var(--text)]">
                    {label}
                    <input
                      translate="no"
                      value={branding[key] ?? ""}
                      onChange={(e) => setBranding((v) => ({ ...v, [key]: e.target.value }))}
                      className="mt-1 w-full rounded border p-2.5"
                    />
                  </label>
                ))}
                <label className="text-sm font-semibold text-[var(--text)] sm:col-span-2">
                  Principal&apos;s message
                  <textarea
                    translate="no"
                    rows={5}
                    maxLength={1800}
                    value={branding.principalMessage}
                    onChange={(e) =>
                      setBranding((v) => ({
                        ...v,
                        principalMessage: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border p-2.5"
                  />
                </label>
                <label className="text-sm font-semibold text-[var(--text)] sm:col-span-2">
                  Social links (one per line: Label|https://... )
                  <textarea
                    translate="no"
                    rows={4}
                    value={branding.socialLinks}
                    onChange={(e) =>
                      setBranding((v) => ({
                        ...v,
                        socialLinks: e.target.value,
                      }))
                    }
                    placeholder="Facebook|https://facebook.com/..."
                    className="mt-1 w-full rounded border p-2.5"
                  />
                </label>
                <button
                  disabled={busy} aria-busy={busy}
                  className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--on-primary)] sm:col-span-2"
                >
                  Save site branding
                </button>
              </form>
            </section>
          )}
          {tab === "announcement" && (role === "superadmin" || role === "approver") && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Public announcement banner</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                The notice appears at the top of the home page only during its scheduled date range.
                Text is plain text; HTML is removed.
              </p>
              <form onSubmit={saveAnnouncement} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    translate="no"
                    type="checkbox"
                    checked={announcement.enabled}
                    onChange={(e) =>
                      setAnnouncement((v) => ({
                        ...v,
                        enabled: e.target.checked,
                      }))
                    }
                    className="h-5 w-5"
                  />{" "}
                  Enable announcement
                </label>
                <label className="text-sm font-semibold">
                  Type
                  <select
                    translate="no"
                    value={announcement.type}
                    onChange={(e) =>
                      setAnnouncement((v) => ({
                        ...v,
                        type: e.target.value as "info" | "warning",
                      }))
                    }
                    className="mt-1 w-full rounded border p-2.5"
                  >
                    <option value="info">Information</option>
                    <option value="warning">Warning</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Notice text (English)
                  <textarea
                    translate="no"
                    required
                    maxLength={240}
                    rows={3}
                    value={announcement.textEn}
                    onChange={(e) =>
                      setAnnouncement((v) => ({
                        ...v,
                        textEn: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border p-2.5"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Optional HTTPS link
                  <input
                    translate="no"
                    type="url"
                    value={announcement.linkUrl}
                    onChange={(e) =>
                      setAnnouncement((v) => ({
                        ...v,
                        linkUrl: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="mt-1 w-full rounded border p-2.5"
                  />
                </label>
                <div className="text-xs text-[var(--text-muted)] self-end">The link opens in a new tab.</div>
                <label className="text-sm font-semibold">
                  Start date and time
                  <input
                    translate="no"
                    type="datetime-local"
                    required
                    value={announcement.startAt}
                    onChange={(e) =>
                      setAnnouncement((v) => ({
                        ...v,
                        startAt: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border p-2.5"
                  />
                </label>
                <label className="text-sm font-semibold">
                  End date and time
                  <input
                    translate="no"
                    type="datetime-local"
                    required
                    value={announcement.endAt}
                    onChange={(e) =>
                      setAnnouncement((v) => ({
                        ...v,
                        endAt: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded border p-2.5"
                  />
                </label>
                <button
                  disabled={busy} aria-busy={busy}
                  className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--on-primary)] sm:col-span-2"
                >
                  Save announcement
                </button>
              </form>
            </section>
          )}
          {tab === "retention" && role === "superadmin" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Retention review queue</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Expired records are flagged for human review only. The scheduled job never deletes
                records automatically.
              </p>
              <div className="mt-5 space-y-4">
                {retentionRetryJobs.length > 0 && (
                  <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                    <h3 className="font-semibold text-[var(--text)]">
                      Erasure operations requiring retry
                    </h3>
                    <div className="mt-3 space-y-2">
                      {retentionRetryJobs.map((job) => (
                        <div
                          key={String(job.id)}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border bg-[var(--surface)] p-3"
                        >
                          <div>
                            <b className="text-sm">{String(job.id)}</b>
                            <p className="text-xs text-[var(--text-muted)]">
                              Status: retry required · {String(job.lastErrorCode ?? "")}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              void act(async () => {
                                await api("/api/admin/retention-review", {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    action: "retry",
                                    jobId: job.id,
                                  }),
                                });
                                await load();
                              })
                            }
                            className="rounded bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)]"
                          >
                            Retry erasure
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {retentionRecords.map((record) => {
                  const student = (record.student ?? {}) as Record<string, unknown>;
                  return (
                    <article key={String(record.id)} className="rounded-lg border p-4">
                      <div className="flex flex-wrap justify-between gap-2">
                        <b>{String(student.studentName ?? "Student record")}</b>
                        <span className="text-xs text-[var(--text-muted)]">
                          Session {String(student.session ?? "—")} · Expired{" "}
                          {String(record.retentionExpiresAt ?? "—")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Father: {String(student.fatherName ?? "—")} · Mother:{" "}
                        {String(student.motherName ?? "—")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            const reason = prompt(
                              "Reason for extending retention (minimum 10 characters):",
                            );
                            if (!reason) return;
                            const years = Number(prompt("Extend by how many years?", "3"));
                            void act(async () => {
                              await api("/api/admin/retention-review", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  studentId: record.id,
                                  action: "extend",
                                  reason,
                                  years,
                                }),
                              });
                              await load();
                            });
                          }}
                          className="rounded border px-3 py-2 text-sm"
                        >
                          Extend retention
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt(
                              "Reason for dismissing this flag (minimum 10 characters):",
                            );
                            if (!reason) return;
                            void act(async () => {
                              await api("/api/admin/retention-review", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  studentId: record.id,
                                  action: "dismiss",
                                  reason,
                                }),
                              });
                              await load();
                            });
                          }}
                          className="rounded border px-3 py-2 text-sm"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => {
                            const confirmText = prompt(
                              "Type ERASE to permanently erase this student's data:",
                            );
                            if (confirmText !== "ERASE") return;
                            const reason = prompt(
                              "Document the legal basis / requester reason (minimum 10 characters):",
                            );
                            if (!reason) return;
                            void act(async () => {
                              await api("/api/admin/retention-review", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  studentId: record.id,
                                  action: "erase",
                                  confirm: "ERASE",
                                  reason,
                                }),
                              });
                              await load();
                            });
                          }}
                          className="rounded bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)]"
                        >
                          Approve erasure
                        </button>
                      </div>
                    </article>
                  );
                })}
                {retentionRecords.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">
                    No records currently require retention review.
                  </p>
                )}
              </div>
            </section>
          )}
          {tab === "reports" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Wrong-record reports</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Reference IDs submitted by the public portal. Limit access to staff handling student
                records.
              </p>
              <div className="mt-5 space-y-3">
                {reports.map((r) => (
                  <article key={String(r.id)} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <b>{String(r.id)}</b>
                      <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold">
                        {String(r.status ?? "open")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      <b>{String(r.name ?? "")}</b> · {String(r.session ?? "")}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text)]">
                      {String(r.issue ?? "")}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Contact: {String(r.contact ?? "")} · Created: {String(r.createdAt ?? "")}
                    </p>
                    <textarea
                      translate="no"
                      value={reportNotes[String(r.id)] ?? String(r.adminNote ?? "")}
                      onChange={(e) =>
                        setReportNotes((v) => ({
                          ...v,
                          [String(r.id)]: e.target.value,
                        }))
                      }
                      placeholder="Internal handling note"
                      rows={2}
                      className="mt-3 w-full rounded border p-2 text-sm"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["open", "reviewing", "resolved", "rejected"] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => updateReport(String(r.id), status)}
                          className="rounded border px-3 py-1.5 text-xs font-semibold capitalize"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {tab === "faqs" && role === "superadmin" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Editable public FAQs</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Content is saved in siteSettings/main and displayed on the public FAQ page. Visitors
                can request machine translation using the public language control.
              </p>
              <div className="mt-5 space-y-5">
                {faqs.map((faq, index) => (
                  <article key={index} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 flex items-center justify-between">
                      <b>FAQ {index + 1}</b>
                      <button
                        onClick={() => setFaqs((v) => v.filter((_, i) => i !== index))}
                        className="text-sm text-[var(--danger)]"
                      >
                        Remove
                      </button>
                    </div>
                    {(
                      [
                        ["questionEn", "Question (English)"],
                        ["answerEn", "Answer (English)"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="text-sm font-semibold">
                        {label}
                        {key.startsWith("answer") ? (
                          <textarea
                            translate="no"
                            rows={4}
                            value={faq[key]}
                            onChange={(e) =>
                              setFaqs((v) =>
                                v.map((x, i) =>
                                  i === index ? { ...x, [key]: e.target.value } : x,
                                ),
                              )
                            }
                            className="mt-1 w-full rounded border p-2"
                          />
                        ) : (
                          <input
                            translate="no"
                            value={faq[key]}
                            onChange={(e) =>
                              setFaqs((v) =>
                                v.map((x, i) =>
                                  i === index ? { ...x, [key]: e.target.value } : x,
                                ),
                              )
                            }
                            className="mt-1 w-full rounded border p-2"
                          />
                        )}
                      </label>
                    ))}
                  </article>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    setFaqs((v) => [
                      ...v,
                      {
                        questionEn: "",
                        answerEn: "",
                      },
                    ])
                  }
                  className="rounded border px-4 py-2 text-sm"
                >
                  Add FAQ
                </button>
                <button
                  onClick={saveFaqs}
                  disabled={busy} aria-busy={busy}
                  className="rounded bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
                >
                  Save FAQs
                </button>
              </div>
            </section>
          )}
          {tab === "admins" && role === "superadmin" && (
            <section className="rounded-xl border bg-[var(--surface)] p-5">
              <h2 className="text-lg font-bold">Admin users (superadmin only)</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => exportData("json")}
                  className="rounded border px-3 py-2 text-sm"
                >
                  Export encrypted JSON
                </button>
                <button
                  onClick={() => exportData("csv")}
                  className="rounded border px-3 py-2 text-sm"
                >
                  Export encrypted CSV
                </button>
                <button onClick={createBackup} className="rounded border px-3 py-2 text-sm">
                  Create private R2 backup
                </button>
              </div>
              <form onSubmit={invite} className="mt-4 flex flex-wrap gap-2">
                <input
                  translate="no"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="New staff email"
                  className="rounded border px-3 py-2"
                />
                <select
                  translate="no"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="rounded border px-3 py-2"
                >
                  <option value="uploader">Uploader</option>
                  <option value="approver">Approver</option>
                  <option value="superadmin">Superadmin</option>
                </select>
                <button className="rounded bg-[var(--primary)] px-4 py-2 text-[var(--on-primary)]">
                  Invite admin
                </button>
              </form>
              <div className="mt-5 space-y-2">
                {admins.map((a) => (
                  <article
                    key={String(a.uid)}
                    className="flex items-center justify-between rounded border p-3 text-sm"
                  >
                    <span>
                      {String(a.email)} · {String(a.role)} · {String(a.status)}
                    </span>
                    <select
                      translate="no"
                      aria-label={`Role for ${String(a.email)}`}
                      value={String(a.role)}
                      onChange={(e) =>
                        changeRole(
                          String(a.uid),
                          e.target.value as "uploader" | "approver" | "superadmin",
                        )
                      }
                      className="rounded border p-1"
                    >
                      <option value="uploader">Uploader</option>
                      <option value="approver">Approver</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                    <button
                      onClick={() => {
                        const disabled = a.status !== "disabled";
                        if (confirm(`${disabled ? "Disable" : "Enable"} this administrator?`))
                          act(async () => {
                            await api("/api/admin/users", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ uid: a.uid, disabled }),
                            });
                            await load();
                          });
                      }}
                      className="text-[var(--danger)]"
                    >
                      {a.status === "disabled" ? "Enable" : "Disable"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}
          <p className="mt-6 text-xs text-[var(--text-muted)]">
            All admin actions are server-authorized, CSRF-protected, and audited.{" "}
            <Link href="/" className="underline">
              Public portal
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
