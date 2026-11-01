import { useCallback, type Dispatch, type SetStateAction } from "react";

import type {
  AnnouncementState,
  CatalogKind,
  CatalogOption,
  FaqItem,
} from "../types/admin-state.types";
import type { Cert, Role, Tab } from "../types/admin.types";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type Props = {
  tab: Tab;
  api: Api;
  loadStudents: () => Promise<void>;
  catalogKind: CatalogKind;
  auditAction: string;
  auditStart: string;
  auditEnd: string;
  role: Role;
  timelineStudentId: string;
  setStats: Dispatch<SetStateAction<Record<string, unknown>>>;
  setPending: Dispatch<SetStateAction<Cert[]>>;
  setSessionOptions: Dispatch<SetStateAction<CatalogOption[]>>;
  setTypeOptions: Dispatch<SetStateAction<CatalogOption[]>>;
  setClassOptions: Dispatch<SetStateAction<CatalogOption[]>>;
  setCerts: Dispatch<SetStateAction<Cert[]>>;
  setCatalog: Dispatch<SetStateAction<CatalogOption[]>>;
  setLogs: Dispatch<SetStateAction<Record<string, unknown>[]>>;
  setRights: Dispatch<SetStateAction<Record<string, unknown>[]>>;
  setBreaches: Dispatch<SetStateAction<Record<string, unknown>[]>>;
  setReports: Dispatch<SetStateAction<Record<string, unknown>[]>>;
  setTimeline: Dispatch<SetStateAction<Record<string, unknown>[]>>;
  setReportsLoaded: Dispatch<SetStateAction<boolean>>;
  setRightsLoaded: Dispatch<SetStateAction<boolean>>;
  setBreachesLoaded: Dispatch<SetStateAction<boolean>>;
  setContactEnquiries: Dispatch<SetStateAction<Record<string, unknown>[]>>;
  setFaqs: Dispatch<SetStateAction<FaqItem[]>>;
  setAdmins: Dispatch<SetStateAction<Record<string, unknown>[]>>;
  setMaintenanceMode: Dispatch<SetStateAction<boolean>>;
  setRetentionYears: Dispatch<SetStateAction<string>>;
  setBackupRotationDays: Dispatch<SetStateAction<string>>;
  setBranding: Dispatch<SetStateAction<Record<string, string>>>;
  setAnnouncement: Dispatch<SetStateAction<AnnouncementState>>;
  setAllowedAdminCountries: Dispatch<SetStateAction<string>>;
  setAdminIpAllowlist: Dispatch<SetStateAction<string>>;
  setAdminLocationEnforcementMode: Dispatch<SetStateAction<string>>;
  setRecentLocationBlocks: Dispatch<SetStateAction<Record<string, unknown>[]>>;
  setAdminLocationExceptions: Dispatch<SetStateAction<Record<string, unknown>[]>>;
};
export function useAdminData({
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
  setAllowedAdminCountries,
  setAdminIpAllowlist,
  setAdminLocationEnforcementMode,
  setRecentLocationBlocks,
  setAdminLocationExceptions,
}: Props) {
  const load = useCallback(async () => {
    if (tab === "dashboard") {
      const d = await api<{ stats: Record<string, unknown> }>("/api/admin/dashboard");
      setStats(d.stats ?? {});
    }
    if (tab === "approvals") {
      const d = await api<{ certificates: Cert[] }>("/api/admin/certificates?status=pending");
      setPending((d.certificates ?? []).filter((x) => x.status === "pending"));
    }
    if (tab === "students" || tab === "studentImport" || tab === "studentAdd") {
      const [sessions, types, classes] = await Promise.all([
        api<{ items: { id: string; label?: string; name?: string }[] }>(
          "/api/admin/catalog/sessions",
        ),
        api<{ items: { id: string; label?: string; name?: string }[] }>(
          "/api/admin/catalog/certificateTypes",
        ),
        api<{ items: { id: string; label?: string; name?: string }[] }>(
          "/api/admin/catalog/classes",
        ),
      ]);
      if (tab !== "studentAdd") await loadStudents();
      setSessionOptions(sessions.items ?? []);
      setTypeOptions(types.items ?? []);
      setClassOptions(classes.items ?? []);
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
      setRightsLoaded(false);
      const d = await api<{ requests: Record<string, unknown>[] }>("/api/admin/rights?status=open");
      setRights(d.requests ?? []);
      setRightsLoaded(true);
    }
    if (tab === "breaches") {
      setBreachesLoaded(false);
      const d = await api<{ breaches: Record<string, unknown>[] }>("/api/admin/breaches");
      setBreaches(d.breaches ?? []);
      setBreachesLoaded(true);
    }
    if (tab === "reports") {
      setReportsLoaded(false);
      const d = await api<{ reports: Record<string, unknown>[] }>("/api/admin/reports");
      setReports(d.reports ?? []);
      setReportsLoaded(true);
    }
    if (tab === "contacts") {
      const d = await api<{ enquiries: Record<string, unknown>[] }>("/api/admin/contact-enquiries");
      setContactEnquiries(d.enquiries ?? []);
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
      const d = await api<{
        settings: Record<string, unknown>;
        recentLocationBlocks: Record<string, unknown>[];
      }>("/api/admin/site-settings");
      const x = d.settings ?? {};
      setAllowedAdminCountries(
        Array.isArray(x.allowedAdminCountries) ? x.allowedAdminCountries.join(", ") : "IN",
      );
      setAdminIpAllowlist(Array.isArray(x.adminIpAllowlist) ? x.adminIpAllowlist.join("\n") : "");
      setAdminLocationEnforcementMode(String(x.adminLocationEnforcementMode ?? "block"));
      setRecentLocationBlocks(d.recentLocationBlocks ?? []);
      setAdminLocationExceptions(
        Array.isArray(x.adminLocationExceptions)
          ? (x.adminLocationExceptions as Record<string, unknown>[])
          : [],
      );
      setMaintenanceMode(x.maintenanceMode === true);
      setRetentionYears(String(x.retentionYears ?? 7));
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
    if (
      tab === "announcement" &&
      (role === "superadmin" || role === "approver" || role === "admin")
    ) {
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
    setContactEnquiries,
    setReportsLoaded,
    setRightsLoaded,
    setBreachesLoaded,
  ]);
  return load;
}
