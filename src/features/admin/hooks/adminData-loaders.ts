
import type { AnnouncementState, CatalogKind, CatalogOption, FaqItem } from "../types/admin-state.types";
import type { Cert, Role, Tab } from "../types/admin.types";
import type { Dispatch, SetStateAction } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
export type AdminDataLoadProps = {
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
  setAnnouncement: Dispatch<SetStateAction<AnnouncementState>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function displayValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

async function loadDashboard(props: AdminDataLoadProps) {
  const data = await props.api<{ stats: Record<string, unknown> }>("/api/admin/dashboard");
  props.setStats(data.stats);
}

async function loadApprovals(props: AdminDataLoadProps) {
  const data = await props.api<{ certificates: Cert[] }>("/api/admin/certificates?status=pending");
  props.setPending(data.certificates.filter((certificate) => certificate.status === "pending"));
}

async function loadStudentCatalog(props: AdminDataLoadProps) {
  const [sessions, types, classes] = await Promise.all([
    props.api<{ items: CatalogOption[] }>("/api/admin/catalog/sessions"),
    props.api<{ items: CatalogOption[] }>("/api/admin/catalog/certificateTypes"),
    props.api<{ items: CatalogOption[] }>("/api/admin/catalog/classes"),
  ]);
  if (props.tab !== "studentAdd") await props.loadStudents();
  props.setSessionOptions(sessions.items);
  props.setTypeOptions(types.items);
  props.setClassOptions(classes.items);
}

async function loadCertificates(props: AdminDataLoadProps) {
  const [data, sessions, types] = await Promise.all([
    props.api<{ certificates: Cert[] }>("/api/admin/certificates"),
    props.api<{ items: CatalogOption[] }>("/api/admin/catalog/sessions"),
    props.api<{ items: CatalogOption[] }>("/api/admin/catalog/certificateTypes"),
    props.loadStudents(),
  ]);
  props.setCerts(data.certificates);
  props.setSessionOptions(sessions.items);
  props.setTypeOptions(types.items);
}

async function loadCatalog(props: AdminDataLoadProps) {
  const data = await props.api<{ items: CatalogOption[] }>(`/api/admin/catalog/${props.catalogKind}`);
  props.setCatalog(data.items);
}

async function loadAudit(props: AdminDataLoadProps) {
  const params = new URLSearchParams();
  if (props.auditAction) params.set("action", props.auditAction);
  if (props.auditStart) params.set("start", new Date(props.auditStart).toISOString());
  if (props.auditEnd) params.set("end", new Date(`${props.auditEnd}T23:59:59`).toISOString());
  const data = await props.api<{ logs: Record<string, unknown>[] }>(`/api/admin/audit?${params.toString()}`);
  props.setLogs(data.logs);
}

async function loadRights(props: AdminDataLoadProps) {
  props.setRightsLoaded(false);
  const data = await props.api<{ requests: Record<string, unknown>[] }>("/api/admin/rights?status=open");
  props.setRights(data.requests);
  props.setRightsLoaded(true);
}

async function loadBreaches(props: AdminDataLoadProps) {
  props.setBreachesLoaded(false);
  const data = await props.api<{ breaches: Record<string, unknown>[] }>("/api/admin/breaches");
  props.setBreaches(data.breaches);
  props.setBreachesLoaded(true);
}

async function loadReports(props: AdminDataLoadProps) {
  props.setReportsLoaded(false);
  const data = await props.api<{ reports: Record<string, unknown>[] }>("/api/admin/reports");
  props.setReports(data.reports);
  props.setReportsLoaded(true);
}

async function loadContacts(props: AdminDataLoadProps) {
  const data = await props.api<{ enquiries: Record<string, unknown>[] }>("/api/admin/contact-enquiries");
  props.setContactEnquiries(data.enquiries);
}

async function loadTimeline(props: AdminDataLoadProps) {
  const query = props.timelineStudentId ? `?studentId=${encodeURIComponent(props.timelineStudentId)}` : "";
  const data = await props.api<{ events: Record<string, unknown>[] }>(`/api/admin/timeline${query}`);
  props.setTimeline(data.events);
}

async function loadFaqs(props: AdminDataLoadProps) {
  if (props.role !== "superadmin") return;
  const data = await props.api<{ faqs: FaqItem[] }>("/api/admin/faqs");
  if (data.faqs.length) props.setFaqs(data.faqs);
}

async function loadAdmins(props: AdminDataLoadProps) {
  if (props.role !== "superadmin") return;
  const data = await props.api<{ admins: Record<string, unknown>[] }>("/api/admin/users");
  props.setAdmins(data.admins);
}

async function loadAnnouncement(props: AdminDataLoadProps) {
  if (props.role !== "superadmin" && props.role !== "approver") return;
  const data = await props.api<{ announcement: Record<string, unknown> }>("/api/admin/announcements");
  const announcement = data.announcement;
  props.setAnnouncement({
    enabled: announcement.enabled === true,
    type: announcement.type === "warning" ? "warning" : "info",
    textEn: displayValue(announcement.textEn),
    text_i18n: stringMap(announcement.text_i18n),
    linkUrl: displayValue(announcement.linkUrl),
    startAt: localDateTime(announcement.startAt),
    endAt: localDateTime(announcement.endAt),
  });
}

function localDateTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const loaders: Partial<Record<Tab, (props: AdminDataLoadProps) => Promise<void>>> = {
  dashboard: loadDashboard,
  approvals: loadApprovals,
  students: loadStudentCatalog,
  studentImport: loadStudentCatalog,
  studentAdd: loadStudentCatalog,
  certificates: loadCertificates,
  catalog: loadCatalog,
  audit: loadAudit,
  rights: loadRights,
  breaches: loadBreaches,
  reports: loadReports,
  contacts: loadContacts,
  timeline: loadTimeline,
  faqs: loadFaqs,
  admins: loadAdmins,
  announcement: loadAnnouncement,
};

export async function loadAdminData(props: AdminDataLoadProps): Promise<void> {
  await loaders[props.tab]?.(props);
}
