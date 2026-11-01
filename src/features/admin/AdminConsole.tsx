"use client";
/* eslint-disable max-lines -- reason: the shared route-driven console owns all admin sections pending component extraction. */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAdminSession } from "@/features/auth/admin-session";
import { useTheme } from "@/features/theme/ThemeProvider";

import AdminsTab from "./components/admins/AdminsTab";
import ApprovalsTab from "./components/approvals/ApprovalsTab";
import AuditTab from "./components/audit/AuditTab";
import TimelineTab from "./components/audit/TimelineTab";
import CatalogTab from "./components/catalog/CatalogTab";
import CertificatesTab from "./components/certificates/CertificatesTab";
import BreachesTab from "./components/compliance/BreachesTab";
import ContactEnquiriesTab from "./components/compliance/ContactEnquiriesTab";
import ReportsTab from "./components/compliance/ReportsTab";
import RightsTab from "./components/compliance/RightsTab";
import DashboardOverview from "./components/dashboard/DashboardOverview";
import AdminHeader from "./components/layout/AdminHeader";
import AdminLayout from "./components/layout/AdminLayout";
import AdminMobileNav from "./components/layout/AdminMobileNav";
import AdminSidebar from "./components/layout/AdminSidebar";
import AdminStatusBanners from "./components/layout/AdminStatusBanners";
import IdleWarningModal from "./components/modals/IdleWarningModal";
import SessionsModal from "./components/modals/SessionsModal";
import ProfileTab from "./components/profile/ProfileTab";
import AnnouncementTab from "./components/site/AnnouncementTab";
import BrandingTab from "./components/site/BrandingTab";
import FaqsTab from "./components/site/FaqsTab";
import StudentCreatePanel from "./components/students/StudentCreatePanel";
import StudentImportPanel from "./components/students/StudentImportPanel";
import StudentsList from "./components/students/StudentsList";
import { tabRoutes } from "./config/admin-navigation";
import { useAdminApi } from "./hooks/useAdminApi";
import { useAdminData } from "./hooks/useAdminData";
import { useAdminFeedback } from "./hooks/useAdminFeedback";
import { useAdminSessionLifecycle } from "./hooks/useAdminSessionLifecycle";
import { useAdminUsers } from "./hooks/useAdminUsers";
import { useApprovals } from "./hooks/useApprovals";
import { useBulkImport } from "./hooks/useBulkImport";
import { useCertificateIntake } from "./hooks/useCertificateIntake";
import { useCertificateRecords } from "./hooks/useCertificateRecords";
import { useSiteSettingsAdmin } from "./hooks/useSiteSettingsAdmin";
import ReauthModal from "./ReauthModal";

import type { CatalogKind, CatalogOption } from "./types/admin-state.types";
import type { Cert, Tab } from "./types/admin.types";
import type { SubmitEvent } from "react";

function isTab(value: string): value is Tab {
  return Object.hasOwn(tabRoutes, value);
}

function resolveRouteTab(pathname: string): Tab {
  if (pathname === "/admin/tickets") return "contacts";
  const exactRoute = Object.entries(tabRoutes).find(([, route]) => route === pathname)?.[0];
  if (exactRoute && isTab(exactRoute)) return exactRoute;
  const nestedRoute = Object.entries(tabRoutes).find(
    ([tab, route]) => tab !== "dashboard" && pathname.startsWith(`${route}/`),
  )?.[0];
  return nestedRoute && isTab(nestedRoute) ? nestedRoute : "dashboard";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load admin data.";
}

// eslint-disable-next-line max-lines-per-function, complexity -- reason: the shared console coordinates section state and routing across the admin workspace.
export default function AdminPage() {
  const [mobileAdminNav, setMobileAdminNav] = useState(false);
  const router = useRouter();
  const onAdminLogin = useCallback(() => {
    router.push("/admin/login");
  }, [router]);
  const pathname = usePathname();
  const { state: sessionState } = useAdminSession();
  const { theme: themeMode, toggleTheme } = useTheme();
  const tab = resolveRouteTab(pathname);
  const setTab = useCallback(
    (next: Tab) => {
      const destination = tabRoutes[next];
      if (destination !== pathname) router.push(destination);
    },
    [pathname, router],
  );
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [rights, setRights] = useState<Record<string, unknown>[]>([]);
  const [breaches, setBreaches] = useState<Record<string, unknown>[]>([]);
  const [reports, setReports] = useState<Record<string, unknown>[]>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [rightsLoaded, setRightsLoaded] = useState(false);
  const [breachesLoaded, setBreachesLoaded] = useState(false);
  const [contactEnquiries, setContactEnquiries] = useState<Record<string, unknown>[]>([]);
  const [contactEnquiryNotes, setContactEnquiryNotes] = useState<Record<string, string>>({});
  const [admins, setAdmins] = useState<Record<string, unknown>[]>([]);
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const { busy, setBusy, toast, setToast, error, setError, act } = useAdminFeedback();
  const { api, reauthOpen, completeReauth, cancelReauth } = useAdminApi();
  const siteAdmin = useSiteSettingsAdmin(api, act, setToast);
  const {
    retentionYears,
    setRetentionYears,
    backupRotationDays,
    setBackupRotationDays,
    faqs,
    setFaqs,
    maintenanceMode,
    setMaintenanceMode,
    announcement,
    setAnnouncement,
    branding,
    setBranding,
    saveFaqs,
    saveBranding,
    saveAnnouncement,
  } = siteAdmin;
  const lifecycle = useAdminSessionLifecycle({
    sessionState,
    api,
    onLogin: onAdminLogin,
  });
  const {
    uid,
    role,
    email,
    idleWarning,
    sessions,
    recentLogins,
    showSessions,
    setShowSessions,
    sessionsError,
    logout,
    staySignedIn,
    loadSessions,
    revokeSession,
    revokeAllSessions,
  } = lifecycle;
  const loadRef = useRef<(() => Promise<void>) | null>(null);
  const loadLatest = useCallback(() => loadRef.current?.() ?? Promise.resolve(), []);
  const intake = useCertificateIntake({ api, act, setToast, tab, load: loadLatest });
  const {
    students,
    sessionOptions,
    setSessionOptions,
    typeOptions,
    setTypeOptions,
    classOptions,
    setClassOptions,
    form,
    setForm,
    selectedStudent,
    setSelectedStudent,
    files,
    setFiles,
    duplicateHashAcknowledged,
    setDuplicateHashAcknowledged,
    duplicateHashReason,
    setDuplicateHashReason,
    duplicateHashWarning,
    setDuplicateHashWarning,
    notify,
    setNotify,
    loadStudents,
    addStudent,
    removeStudent,
    uploadMany,
  } = intake;
  const bulkImport = useBulkImport({
    act,
    loadStudents,
  });
  const {
    file: studentImportFile,
    setFile: setStudentImportFile,
    preview,
    importStudents,
    downloadTemplate,
  } = bulkImport;
  const approvals = useApprovals({ api, act, setError, load: loadLatest });
  const {
    rejectReason,
    setRejectReason,
    approvalChecks,
    setApprovalChecks,
    previewUrls,
    decideCertificate,
    loadPreview,
  } = approvals;
  const certificateRecords = useCertificateRecords(api, act);
  const { certs, setCerts, certificateHistory, loadCertificateHistory } = certificateRecords;
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("sessions");
  const [catalogName, setCatalogName] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditStart, setAuditStart] = useState("");
  const [auditEnd, setAuditEnd] = useState("");
  const [pending, setPending] = useState<Cert[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [timeline, setTimeline] = useState<Record<string, unknown>[]>([]);
  const [timelineStudentId, setTimelineStudentId] = useState("");
  const load = useAdminData({
    tab,
    api,
    loadStudents,
    catalogKind,
    auditAction,
    auditStart,
    auditEnd,
    role,
    timelineStudentId,
    setStats,
    setPending,
    setSessionOptions,
    setTypeOptions,
    setClassOptions,
    setCerts,
    setCatalog,
    setLogs,
    setRights,
    setBreaches,
    setReports,
    setReportsLoaded,
    setRightsLoaded,
    setBreachesLoaded,
    setTimeline,
    setContactEnquiries,
    setFaqs,
    setAdmins,
    setMaintenanceMode,
    setRetentionYears,
    setBackupRotationDays,
    setBranding,
    setAnnouncement,
  });
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  const adminUsers = useAdminUsers({ api, act, setToast, setError, load: loadLatest });
  const {
    adminEmail,
    setAdminEmail,
    inviteRole,
    setInviteRole,
    inviteProfile,
    setInviteProfile,
    createBackup,
    exportData,
    changeRole,
    deleteUser,
    invite,
  } = adminUsers;

  useEffect(() => {
    if (email) {
      setBusy(true);
      void load()
        .catch((cause: unknown) => {
          setError(errorMessage(cause));
        })
        .finally(() => {
          setBusy(false);
        });
    }
  }, [email, load, setBusy, setError]);
  async function saveCatalog(e: SubmitEvent<HTMLFormElement>) {
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
  async function updateContactEnquiry(
    id: string,
    status: "open" | "reviewing" | "resolved" | "closed",
  ) {
    await act(async () => {
      await api("/api/admin/contact-enquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNote: contactEnquiryNotes[id] ?? "" }),
      });
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
        <IdleWarningModal
          onLogout={() => void logout()}
          onStaySignedIn={() => void staySignedIn()}
        />
      )}
      {showSessions && (
        <SessionsModal
          sessions={sessions}
          recentLogins={recentLogins}
          error={sessionsError}
          onRetry={() => void loadSessions()}
          onClose={() => {
            setShowSessions(false);
          }}
          onRevokeSession={(sessionId) => void revokeSession(sessionId)}
          onRevokeAll={() => void revokeAllSessions()}
        />
      )}
      <AdminLayout>
        <AdminSidebar
          role={role}
          email={email}
          tab={tab}
          setTab={setTab}
          onSettings={() => {
            router.push("/admin/settings");
          }}
          onLoadSessions={() => void loadSessions()}
        />
        <div className="min-w-0 flex-1">
          <AdminHeader
            tab={tab}
            email={email}
            mobileAdminNav={mobileAdminNav}
            setMobileAdminNav={setMobileAdminNav}
            themeMode={themeMode}
            toggleTheme={toggleTheme}
            onTickets={() => {
              router.push(tabRoutes.contacts);
            }}
            onProfile={() => {
              router.push("/admin/profile");
            }}
            loadSessions={() => void loadSessions()}
            revokeAllSessions={() => void revokeAllSessions()}
            logout={() => void logout()}
          />
          <div className="mx-auto w-full max-w-[1440px] px-6 py-7 lg:px-7">
            <AdminMobileNav
              role={role}
              tab={tab}
              setTab={setTab}
              mobileAdminNav={mobileAdminNav}
              setMobileAdminNav={setMobileAdminNav}
            />
            <AdminStatusBanners
              toast={toast}
              error={error}
              busy={busy}
              onRetry={() => {
                setError("");
                setBusy(true);
                void load()
                  .catch((cause: unknown) => {
                    setError(
                      cause instanceof Error ? cause.message : "Unable to reload admin data.",
                    );
                  })
                  .finally(() => {
                    setBusy(false);
                  });
              }}
            />
            {tab === "dashboard" && (
              <DashboardOverview
                stats={stats}
                canManageStudents={role !== "approver"}
                onAddStudent={() => {
                  setTab("studentAdd");
                }}
                onImportRecords={() => {
                  setTab("studentImport");
                }}
              />
            )}
            {tab === "profile" && (
              <ProfileTab
                api={api}
                act={act}
                email={email}
                role={role}
                loadSessions={loadSessions}
              />
            )}
            {tab === "approvals" && (
              <ApprovalsTab
                pending={pending}
                rejectReason={rejectReason}
                setRejectReason={setRejectReason}
                approvalChecks={approvalChecks}
                setApprovalChecks={setApprovalChecks}
                previewUrls={previewUrls}
                decideCertificate={(...args) => void decideCertificate(...args)}
                busy={busy}
                uid={uid}
                role={role}
                loadPreview={(id) => {
                  void loadPreview(id);
                }}
              />
            )}
            {tab === "students" && (
              <div className="space-y-6">
                <StudentsList
                  role={role}
                  students={students}
                  typeOptions={typeOptions}
                  classOptions={classOptions}
                  sessionOptions={sessionOptions}
                  setTimelineStudentId={setTimelineStudentId}
                  setTab={setTab}
                  api={api}
                  loadStudents={loadStudents}
                  removeStudent={removeStudent}
                />
              </div>
            )}
            {tab === "studentAdd" && role !== "approver" && (
              <section className="mx-auto max-w-5xl space-y-5">
                <div className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 sm:p-6">
                  <Link href="/admin/students" className="text-xs font-semibold text-[var(--primary)] hover:underline">← Back to students</Link>
                  <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Student register</p>
                  <h2 className="mt-1 text-2xl font-bold text-[var(--text)]">Add a student manually</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Create one student record and attach the first certificate. To add a whole class, use the separate Excel import page.</p>
                </div>
                <StudentCreatePanel
                  form={form}
                  setForm={setForm}
                  sessionOptions={sessionOptions}
                  typeOptions={typeOptions}
                  classOptions={classOptions}
                  files={files}
                  setFiles={setFiles}
                  notify={notify}
                  setNotify={setNotify}
                  duplicateHashWarning={duplicateHashWarning}
                  duplicateHashAcknowledged={duplicateHashAcknowledged}
                  duplicateHashReason={duplicateHashReason}
                  setDuplicateHashAcknowledged={setDuplicateHashAcknowledged}
                  setDuplicateHashReason={setDuplicateHashReason}
                  busy={busy}
                  addStudent={(event) => void addStudent(event)}
                />
              </section>
            )}
            {tab === "studentImport" && role !== "approver" && (
              <div className="space-y-6">
                <StudentImportPanel
                  busy={busy}
                  file={studentImportFile}
                  setFile={setStudentImportFile}
                  preview={preview}
                  importStudents={importStudents}
                  downloadTemplate={downloadTemplate}
                  classOptions={classOptions}
                  sessionOptions={sessionOptions}
                />
                <StudentsList
                  role={role}
                  students={students.filter((student) => student.importedFromExcel === true)}
                  typeOptions={typeOptions}
                  classOptions={classOptions}
                  sessionOptions={sessionOptions}
                  setTimelineStudentId={setTimelineStudentId}
                  setTab={setTab}
                  api={api}
                  loadStudents={loadStudents}
                  removeStudent={removeStudent}
                />
              </div>
            )}
            {tab === "certificates" && (
              <CertificatesTab
                role={role}
                form={form}
                setForm={setForm}
                sessionOptions={sessionOptions}
                typeOptions={typeOptions}
                files={files}
                setFiles={setFiles}
                duplicateHashWarning={duplicateHashWarning}
                duplicateHashAcknowledged={duplicateHashAcknowledged}
                setDuplicateHashAcknowledged={setDuplicateHashAcknowledged}
                duplicateHashReason={duplicateHashReason}
                setDuplicateHashReason={setDuplicateHashReason}
                setDuplicateHashWarning={setDuplicateHashWarning}
                busy={busy}
                students={students}
                selectedStudent={selectedStudent}
                setSelectedStudent={setSelectedStudent}
                uploadMany={(event) => {
                  void uploadMany(event);
                }}
                certs={certs}
                certificateHistory={certificateHistory}
                loadCertificateHistory={loadCertificateHistory}
                act={act}
                api={api}
                load={load}
                setError={setError}
              />
            )}
            {tab === "catalog" && (
              <CatalogTab
                role={role}
                catalogKind={catalogKind}
                setCatalogKind={setCatalogKind}
                catalogName={catalogName}
                setCatalogName={setCatalogName}
                catalog={catalog}
                saveCatalog={(event) => {
                  void saveCatalog(event);
                }}
                act={act}
                api={api}
                load={load}
              />
            )}
            {tab === "audit" && (
              <AuditTab
                auditAction={auditAction}
                setAuditAction={setAuditAction}
                auditStart={auditStart}
                setAuditStart={setAuditStart}
                auditEnd={auditEnd}
                setAuditEnd={setAuditEnd}
                logs={logs}
                load={load}
              />
            )}
            {tab === "rights" && (
              <RightsTab
                role={role}
                rights={rights}
                loaded={rightsLoaded}
                resolution={resolution}
                setResolution={setResolution}
                resolveRight={resolveRight}
                act={act}
                api={api}
                load={load}
                setToast={setToast}
              />
            )}
            {tab === "breaches" && (
              <BreachesTab
                breaches={breaches}
                loaded={breachesLoaded}
                act={act}
                api={api}
                load={load}
              />
            )}
            {tab === "timeline" && (
              <TimelineTab
                timelineStudentId={timelineStudentId}
                setTimelineStudentId={setTimelineStudentId}
                timeline={timeline}
              />
            )}
            {tab === "branding" && role === "superadmin" && (
              <BrandingTab
                branding={branding}
                setBranding={setBranding}
                retentionYears={retentionYears}
                setRetentionYears={setRetentionYears}
                backupRotationDays={backupRotationDays}
                setBackupRotationDays={setBackupRotationDays}
                maintenanceMode={maintenanceMode}
                setMaintenanceMode={setMaintenanceMode}
                busy={busy}
                saveBranding={(event) => {
                  void saveBranding(event);
                }}
              />
            )}
            {tab === "announcement" &&
              (role === "superadmin" || role === "approver" || role === "admin") && (
                <AnnouncementTab
                  announcement={announcement}
                  setAnnouncement={setAnnouncement}
                  busy={busy}
                  saveAnnouncement={(event) => {
                    void saveAnnouncement(event);
                  }}
                />
              )}
            {tab === "reports" && (
              <ReportsTab
                reports={reports}
                loaded={reportsLoaded}
                reportNotes={reportNotes}
                setReportNotes={setReportNotes}
                updateReport={(id, status) => {
                  void updateReport(id, status);
                }}
              />
            )}
            {tab === "contacts" && (
              <ContactEnquiriesTab
                enquiries={contactEnquiries}
                notes={contactEnquiryNotes}
                setNotes={setContactEnquiryNotes}
                update={(id, status) => {
                  void updateContactEnquiry(id, status);
                }}
              />
            )}
            {tab === "faqs" && role === "superadmin" && (
              <FaqsTab faqs={faqs} setFaqs={setFaqs} saveFaqs={saveFaqs} busy={busy} />
            )}
            {tab === "admins" && role === "superadmin" && (
              <AdminsTab
                admins={admins}
                adminEmail={adminEmail}
                setAdminEmail={setAdminEmail}
                inviteRole={inviteRole}
                setInviteRole={setInviteRole}
                inviteProfile={inviteProfile}
                setInviteProfile={setInviteProfile}
                invite={(event) => {
                  void invite(event);
                }}
                exportData={exportData}
                createBackup={createBackup}
                changeRole={changeRole}
                deleteUser={deleteUser}
                act={act}
                api={api}
                load={load}
              />
            )}
            <p className="mt-6 text-xs text-[var(--text-muted)]">
              All admin actions are server-authorized, CSRF-protected, and audited.{" "}
              <Link href="/" className="underline">
                Public portal
              </Link>
            </p>
          </div>
        </div>
      </AdminLayout>
      {reauthOpen && (
        <ReauthModal email={email} onComplete={completeReauth} onCancel={cancelReauth} />
      )}
    </>
  );
}
