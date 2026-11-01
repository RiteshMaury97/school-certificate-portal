export type Role = "uploader" | "approver" | "admin" | "superadmin";
export type Student = {
  id: string;
  admissionNo?: string;
  dateOfBirth?: string;
  parentEmail?: string;
  parentMobile?: string;
  notificationConsent?: boolean;
  studentName: string;
  fatherName: string;
  motherName: string;
  className: string;
  scholarNumber: string;
  session: string;
  certificateCount: number;
};
export type Cert = {
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
export type Tab =
  | "dashboard"
  | "approvals"
  | "students"
  | "studentIntake"
  | "studentImport"
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
  | "contacts"
  | "profile";
