"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAdminSession } from "@/features/auth/admin-session";
import { useTheme } from "@/features/theme/ThemeProvider";
import { appCheckHeaders } from "@/lib/firebase-client";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

import AdminsTab from "./components/admins/AdminsTab";
import ApprovalsTab from "./components/approvals/ApprovalsTab";
import AuditTab from "./components/audit/AuditTab";
import TimelineTab from "./components/audit/TimelineTab";
import CatalogTab from "./components/catalog/CatalogTab";
import BreachesTab from "./components/compliance/BreachesTab";
import ContactEnquiriesTab from "./components/compliance/ContactEnquiriesTab";
import ReportsTab from "./components/compliance/ReportsTab";
import DashboardOverview from "./components/dashboard/DashboardOverview";
import HelpPolicies from "./components/help/HelpPolicies";
import AdminLayout from "./components/layout/AdminLayout";
import AdminSidebar from "./components/layout/AdminSidebar";
import AdminHeader from "./components/layout/AdminHeader";
import AdminMobileNav from "./components/layout/AdminMobileNav";
import AdminStatusBanners from "./components/layout/AdminStatusBanners";
import ProfileTab from "./components/profile/ProfileTab";
import IdleWarningModal from "./components/modals/IdleWarningModal";
import SessionsModal from "./components/modals/SessionsModal";
import RightsTab from "./components/compliance/RightsTab";
import RetentionTab from "./components/compliance/RetentionTab";
import AnnouncementTab from "./components/site/AnnouncementTab";
import BrandingTab from "./components/site/BrandingTab";
import FaqsTab from "./components/site/FaqsTab";
import CertificatesTab from "./components/certificates/CertificatesTab";
import StudentCreatePanel from "./components/students/StudentCreatePanel";
import StudentsList from "./components/students/StudentsList";
import { tabLabels, tabRoutes } from "./config/admin-navigation";
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
import { csrf } from "./utils/admin-helpers";

import type {
  CatalogKind,
  CatalogOption,
} from "./types/admin-state.types";
import type { Cert, Tab } from "./types/admin.types";
import type { FormEvent} from "react";
export default function AdminPage() {
  const [mobileAdminNav, setMobileAdminNav] = useState(false);
  const siteSettings = usePublicSiteSettings();
  const router = useRouter();
  const onAdminLogin = useCallback(() => { router.push("/admin/login"); }, [router]);
  const pathname = usePathname();
  const { state: sessionState } = useAdminSession();
  const { theme: themeMode, toggleTheme } = useTheme();
  const routeTab = (pathname === "/admin/tickets"
    ? "contacts"
    : Object.entries(tabRoutes).find(([, route]) => route === pathname)?.[0] ??
    Object.entries(tabRoutes).find(
      ([tab, route]) => tab !== "dashboard" && pathname.startsWith(`${route}/`),
    )?.[0] ?? "dashboard") as Tab;
  const [tab, setTabState] = useState<Tab>(routeTab);
  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    const destination = tabRoutes[next];
    if (destination !== pathname) router.push(destination);
  }, [pathname, router]);
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [rights, setRights] = useState<Record<string, unknown>[]>([]);
  const [retentionRecords, setRetentionRecords] = useState<Record<string, unknown>[]>([]);
  const [retentionRetryJobs, setRetentionRetryJobs] = useState<Record<string, unknown>[]>([]);
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
    retentionYears, setRetentionYears, retentionConfirmed, setRetentionConfirmed,
    backupRotationDays, setBackupRotationDays, faqs, setFaqs, maintenanceMode, setMaintenanceMode,
    announcement, setAnnouncement, branding, setBranding, saveFaqs, saveBranding, saveAnnouncement,
  } = siteAdmin;
  const lifecycle = useAdminSessionLifecycle({
    sessionState,
    api,
    onLogin: onAdminLogin,
  });
  const {
    uid, role, email, idleWarning, setIdleWarning, sessions, recentLogins, showSessions,
    setShowSessions, sessionsError, logout, staySignedIn, loadSessions, revokeSession, revokeAllSessions,
  } = lifecycle;
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const intake = useCertificateIntake({ api, act, setToast, tab, load: () => loadRef.current() });
  const {
    students, sessionOptions, setSessionOptions, typeOptions, setTypeOptions, classOptions, setClassOptions,
    search, setSearch, page, setPage, form, setForm, selectedStudent, setSelectedStudent, files, setFiles,
    duplicateHashAcknowledged, setDuplicateHashAcknowledged, duplicateHashReason, setDuplicateHashReason,
    duplicateHashWarning, setDuplicateHashWarning, notify, setNotify, loadStudents, filtered, visible,
    addStudent, removeStudent, uploadMany,
  } = intake;
  const bulkImport = useBulkImport({
    api, act, setError, load: () => loadRef.current(), loadStudents,
    duplicateHashAcknowledged, duplicateHashReason, setDuplicateHashWarning,
  });
  const {
    csv, setCsv, preview, bulkFiles, setBulkFiles, bulkCsv, setBulkCsv,
    bulkPreview, bulkProgress, importCsv, previewBulk, commitBulk, downloadTemplate,
  } = bulkImport;
  const approvals = useApprovals({ api, act, setError, load: () => loadRef.current() });
  const {
    rejectReason, setRejectReason, approvalChecks, setApprovalChecks, previewUrls, decideCertificate, loadPreview,
  } = approvals;
  const certificateRecords = useCertificateRecords(api, act);
  const { certs, setCerts, certificateHistory, loadCertificateHistory } = certificateRecords;
  useEffect(() => {
    setTab(routeTab);
  }, [routeTab, setTab]);
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
    tab, api, loadStudents, catalogKind, auditAction, auditStart, auditEnd, role, timelineStudentId,
    setStats, setPending, setSessionOptions, setTypeOptions, setClassOptions, setCerts, setCatalog, setLogs, setRights,
    setRetentionRecords, setRetentionRetryJobs, setBreaches, setReports, setReportsLoaded, setRightsLoaded, setBreachesLoaded, setTimeline, setContactEnquiries, setFaqs, setAdmins,
    setMaintenanceMode, setRetentionYears, setRetentionConfirmed, setBackupRotationDays, setBranding, setAnnouncement,
  });
  loadRef.current = load;
  const adminUsers = useAdminUsers({ api, act, setToast, setError, load: () => loadRef.current() });
  const {
    adminEmail, setAdminEmail, inviteRole, setInviteRole, inviteProfile, setInviteProfile,
    createBackup, exportData, changeRole, deleteUser, invite,
  } = adminUsers;

  useEffect(() => {
    if (email) {
      setBusy(true);
      load()
        .catch((e) => { setError(e.message); })
        .finally(() => { setBusy(false); });
    }
  }, [email, load]);
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
  async function updateContactEnquiry(id: string, status: "open" | "reviewing" | "resolved" | "closed") {
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
        <IdleWarningModal onLogout={() => void logout()} onStaySignedIn={() => void staySignedIn()} />
      )}
      {showSessions && (
        <SessionsModal
          sessions={sessions}
          recentLogins={recentLogins}
          error={sessionsError}
          onRetry={() => void loadSessions()}
          onClose={() => { setShowSessions(false); }}
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
          setPage={setPage}
          onSettings={() => { router.push("/admin/settings"); }}
          onSystemHealth={() => { router.push("/admin/backup"); }}
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
          onTickets={() => { router.push(tabRoutes.contacts); }}
          onProfile={() => { router.push("/admin/profile"); }}
          loadSessions={() => void loadSessions()}
          revokeAllSessions={() => void revokeAllSessions()}
          logout={() => void logout()}
        />
        <div className="mx-auto w-full max-w-[1440px] px-6 py-7 lg:px-7">
          <AdminMobileNav
            role={role}
            tab={tab}
            setTab={setTab}
            setPage={setPage}
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
                .catch((cause) => { setError(cause instanceof Error ? cause.message : "Unable to reload admin data."); },
                )
                .finally(() => { setBusy(false); });
            }}
          />
{tab === "help" && <HelpPolicies />}
          {tab === "dashboard" && (
            <DashboardOverview
              stats={stats}
              canManageStudents={role !== "approver"}
              onAddStudent={() => { setTab("students"); }}
              onImportRecords={() => { setTab("students"); }}
            />
          )}
          {tab === "profile" && <ProfileTab api={api} act={act} email={email} role={role} loadSessions={loadSessions} />}
          {tab === "approvals" && (
            <ApprovalsTab
              pending={pending}
              rejectReason={rejectReason}
              setRejectReason={setRejectReason}
              approvalChecks={approvalChecks}
              setApprovalChecks={setApprovalChecks}
              previewUrls={previewUrls}
              decideCertificate={decideCertificate}
              busy={busy}
              uid={uid}
              role={role}
              loadPreview={loadPreview}
            />
          )}
          {tab === "students" && (
            <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
              {role !== "approver" && (
                <StudentCreatePanel
                  form={form} setForm={setForm} sessionOptions={sessionOptions} typeOptions={typeOptions} classOptions={classOptions}
                  files={files} setFiles={setFiles} notify={notify} setNotify={setNotify}
                  duplicateHashWarning={duplicateHashWarning} duplicateHashAcknowledged={duplicateHashAcknowledged}
                  duplicateHashReason={duplicateHashReason} setDuplicateHashAcknowledged={setDuplicateHashAcknowledged}
                  setDuplicateHashReason={setDuplicateHashReason} busy={busy} addStudent={addStudent}
                  downloadTemplate={downloadTemplate} csv={csv} setCsv={setCsv} importCsv={importCsv}
                  preview={preview} bulkFiles={bulkFiles} setBulkFiles={setBulkFiles} bulkCsv={bulkCsv}
                  setBulkCsv={setBulkCsv} bulkPreview={bulkPreview} bulkProgress={bulkProgress}
                  previewBulk={previewBulk} commitBulk={commitBulk}
                />
              )}
              <StudentsList
                role={role} visible={visible} filtered={filtered} search={search} setSearch={setSearch}
                page={page} setPage={setPage} setTimelineStudentId={setTimelineStudentId} setTab={setTab}
                setSelectedStudent={setSelectedStudent} act={act} api={api} loadStudents={loadStudents} removeStudent={removeStudent}
              />
            </div>
          )}
          {tab === "certificates" && (
            <CertificatesTab
              role={role} form={form} setForm={setForm} sessionOptions={sessionOptions} typeOptions={typeOptions}
              files={files} setFiles={setFiles} duplicateHashWarning={duplicateHashWarning}
              duplicateHashAcknowledged={duplicateHashAcknowledged} setDuplicateHashAcknowledged={setDuplicateHashAcknowledged}
              duplicateHashReason={duplicateHashReason} setDuplicateHashReason={setDuplicateHashReason}
              setDuplicateHashWarning={setDuplicateHashWarning} busy={busy} students={students}
              selectedStudent={selectedStudent} setSelectedStudent={setSelectedStudent} uploadMany={uploadMany}
              certs={certs} certificateHistory={certificateHistory} loadCertificateHistory={loadCertificateHistory}
              act={act} api={api} load={load} setError={setError}
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
              saveCatalog={saveCatalog}
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
            <RightsTab role={role} rights={rights} loaded={rightsLoaded} resolution={resolution} setResolution={setResolution} resolveRight={resolveRight} act={act} api={api} load={load} setToast={setToast} />
          )}
          {tab === "breaches" && <BreachesTab breaches={breaches} loaded={breachesLoaded} act={act} api={api} load={load} />}
          {tab === "timeline" && (
            <TimelineTab
              timelineStudentId={timelineStudentId}
              setTimelineStudentId={setTimelineStudentId}
              timeline={timeline}
            />
          )}
          {tab === "branding" && role === "superadmin" && (
            <BrandingTab
              branding={branding} setBranding={setBranding} retentionYears={retentionYears} setRetentionYears={setRetentionYears}
              retentionConfirmed={retentionConfirmed} setRetentionConfirmed={setRetentionConfirmed}
              backupRotationDays={backupRotationDays} setBackupRotationDays={setBackupRotationDays}
              maintenanceMode={maintenanceMode} setMaintenanceMode={setMaintenanceMode} busy={busy} saveBranding={saveBranding}
            />
          )}
          {tab === "announcement" && (role === "superadmin" || role === "approver" || role === "admin") && (
            <AnnouncementTab announcement={announcement} setAnnouncement={setAnnouncement} busy={busy} saveAnnouncement={saveAnnouncement} />
          )}
          {tab === "retention" && role === "superadmin" && (
            <RetentionTab retentionRecords={retentionRecords} retentionRetryJobs={retentionRetryJobs} act={act} api={api} load={load} />
          )}
          {tab === "reports" && (
            <ReportsTab reports={reports} loaded={reportsLoaded} reportNotes={reportNotes} setReportNotes={setReportNotes} updateReport={updateReport} />
          )}
          {tab === "contacts" && (
            <ContactEnquiriesTab enquiries={contactEnquiries} notes={contactEnquiryNotes} setNotes={setContactEnquiryNotes} update={updateContactEnquiry} />
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
              invite={invite}
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
      {reauthOpen && <ReauthModal email={email} onComplete={completeReauth} onCancel={cancelReauth} />}
    </>
  );
}
