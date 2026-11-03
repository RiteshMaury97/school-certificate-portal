import type { Cert } from "./admin.types";

export type CatalogOption = {
  id: string;
  label?: string;
  name?: string;
  isActive?: boolean;
};
export type FaqItem = { questionEn: string; answerEn: string; question_i18n?: Record<string, string>; answer_i18n?: Record<string, string> };
export type StudentFormState = {
  admissionNumber: string;
  dateOfBirth: string;
  studentName: string;
  fatherName: string;
  motherName: string;
  className: string;
  scholarNumber: string;
  session: string;
  certificateType: string;
  certificateNumber: string;
  issuedAt: string;
};
export type BulkPreviewItem = {
  fileName: string;
  size: number;
  valid: boolean;
  errors: string[];
  mapping: Record<string, string> | null;
};
export type StudentImportCellError = {
  column: string;
  message: string;
};
export type StudentImportRow = {
  row: number;
  data: Pick<
    StudentFormState,
    | "admissionNumber"
    | "dateOfBirth"
    | "studentName"
    | "fatherName"
    | "motherName"
    | "className"
    | "scholarNumber"
    | "session"
  > | null;
  values: Record<string, string>;
  error: string | null;
  fieldErrors: StudentImportCellError[];
};
export type StudentImportPreview = {
  total: number;
  valid: number;
  errors: StudentImportRow[];
  preview: StudentImportRow[];
};
export type NotifyState = { email: string; mobile: string; consent: boolean };
export type AnnouncementState = {
  enabled: boolean;
  type: "info" | "warning";
  textEn: string;
  text_i18n?: Record<string, string>;
  linkUrl: string;
  startAt: string;
  endAt: string;
};
export type PreviewUrl = { url: string; mimeType: string };
export type CertificateHistory = Record<string, Record<string, unknown>[]>;
export type CertificatePreviewMap = Record<string, PreviewUrl>;
export type AdminRecord = Record<string, unknown>;
export type BrandingState = Record<string, string>;
export type AdminInviteRole = "uploader" | "approver" | "admin" | "superadmin";
export type AdminInviteProfile = {
  name: string;
  preferredName: string;
  staffId: string;
  gender: string;
  dateOfBirth: string;
  position: string;
  department: string;
  designation: string;
  campus: string;
  joiningDate: string;
  reportingManager: string;
  officeLocation: string;
  alternateEmail: string;
  primaryPhone: string;
  secondaryPhone: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};
export type CatalogKind = "sessions" | "certificateTypes" | "classes";
export type PendingCertificate = Cert;
