"use client";
import { lazy, useEffect } from "react";
import { Route, Routes } from "react-router-dom";

import ProtectedRoute from "@/src/app/ProtectedRoute";

import type { ReactNode } from "react";

const HomePage = lazy(() => import("@/src/pages/public/HomePage"));
const CertificatesPage = lazy(() => import("@/src/pages/public/CertificatesPage"));
const ResultsPage = lazy(() => import("@/src/pages/public/ResultsPage"));
const PrintPage = lazy(() => import("@/src/pages/public/PrintPage"));
const VerifyPage = lazy(() => import("@/src/pages/public/VerifyPage"));
const FaqPage = lazy(() => import("@/src/pages/public/FaqPage"));
const ContactPage = lazy(() => import("@/src/pages/public/ContactPage"));
const ReportWrongRecordPage = lazy(() => import("@/src/pages/public/ReportWrongRecordPage"));
const DataRightsPage = lazy(() => import("@/src/pages/public/DataRightsPage"));
const TermsPage = lazy(() => import("@/src/pages/public/TermsPage"));
const PrivacyPage = lazy(() => import("@/src/pages/public/PrivacyPage"));
const OfflinePage = lazy(() => import("@/src/pages/public/OfflinePage"));
const MaintenancePage = lazy(() => import("@/src/pages/public/MaintenancePage"));
const NotFoundPage = lazy(() => import("@/src/pages/public/NotFoundPage"));

const LoginPage = lazy(() => import("@/src/pages/admin/LoginPage"));
const MfaPage = lazy(() => import("@/src/pages/admin/MfaPage"));
const DashboardPage = lazy(() => import("@/src/pages/admin/DashboardPage"));
const StudentsPage = lazy(() => import("@/src/pages/admin/StudentsPage"));
const AdminCertificatesPage = lazy(() => import("@/src/pages/admin/CertificatesPage"));
const UploadPage = lazy(() => import("@/src/pages/admin/UploadPage"));
const ApprovalsPage = lazy(() => import("@/src/pages/admin/ApprovalsPage"));
const SessionsPage = lazy(() => import("@/src/pages/admin/SessionsPage"));
const TicketsPage = lazy(() => import("@/src/pages/admin/TicketsPage"));
const AuditPage = lazy(() => import("@/src/pages/admin/AuditPage"));
const SettingsPage = lazy(() => import("@/src/pages/admin/SettingsPage"));
const AdminsPage = lazy(() => import("@/src/pages/admin/AdminsPage"));
const BackupPage = lazy(() => import("@/src/pages/admin/BackupPage"));

function AdminArea({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = "en";
  }, []);
  return (
    <div className="notranslate" translate="no">
      {children}
    </div>
  );
}
function Protected({ children }: { children: ReactNode }) {
  return (
    <AdminArea>
      <ProtectedRoute>{children}</ProtectedRoute>
    </AdminArea>
  );
}
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/certificates" element={<CertificatesPage />} />
      <Route path="/certificates/results" element={<ResultsPage />} />
      <Route path="/certificates/print" element={<PrintPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/report-wrong-record" element={<ReportWrongRecordPage />} />
      <Route path="/data-rights" element={<DataRightsPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/offline" element={<OfflinePage />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route
        path="/admin/login"
        element={
          <AdminArea>
            <LoginPage />
          </AdminArea>
        }
      />
      <Route
        path="/admin/mfa"
        element={
          <AdminArea>
            <MfaPage />
          </AdminArea>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route
        path="/admin/students"
        element={
          <Protected>
            <StudentsPage />
          </Protected>
        }
      />
      <Route
        path="/admin/certificates"
        element={
          <Protected>
            <AdminCertificatesPage />
          </Protected>
        }
      />
      <Route
        path="/admin/certificates/upload"
        element={
          <Protected>
            <UploadPage />
          </Protected>
        }
      />
      <Route
        path="/admin/approvals"
        element={
          <Protected>
            <ApprovalsPage />
          </Protected>
        }
      />
      <Route
        path="/admin/sessions"
        element={
          <Protected>
            <SessionsPage />
          </Protected>
        }
      />
      <Route
        path="/admin/tickets"
        element={
          <Protected>
            <TicketsPage />
          </Protected>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <Protected>
            <AuditPage />
          </Protected>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <Protected>
            <SettingsPage />
          </Protected>
        }
      />
      <Route
        path="/admin/admins"
        element={
          <Protected>
            <AdminsPage />
          </Protected>
        }
      />
      <Route
        path="/admin/backup"
        element={
          <Protected>
            <BackupPage />
          </Protected>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
