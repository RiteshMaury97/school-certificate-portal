import { z } from "zod";

export const personNameSchema = z
  .string()
  .trim()
  .min(2, "Enter at least 2 characters.")
  .max(80, "Maximum 80 characters.")
  .regex(
    /^[\p{L}\p{M} .'-]+$/u,
    "Use letters, spaces, apostrophes, periods or hyphens only.",
  );

export function isValidPhoneNumber(value: string): boolean {
  const compact = value.trim().replace(/[ .()-]/g, "");
  return /^(?:[6-9]\d{9}|\+91[6-9]\d{9}|\+[1-9]\d{7,14})$/.test(compact);
}

const optionalPhoneSchema = z.string().trim().max(16).refine(
  (value) => !value || isValidPhoneNumber(value),
  "Enter a 10-digit Indian mobile number or an international number in E.164 format.",
);

export const contactEnquirySchema = z.object({
  fullName: personNameSchema,
  mobile: z.string().trim().min(10).max(16).refine(isValidPhoneNumber,
    "Enter a 10-digit Indian mobile number or an international number in E.164 format."),
  email: z.email().trim().max(254),
  enquiryType: z.enum(["certificate", "student-record", "admission", "general", "other"]),
  studentName: personNameSchema,
  classSession: z.string().trim().min(2, "Enter the class or passing session.").max(80),
  subject: z.string().trim().min(3, "Enter a subject of at least 3 characters.").max(160),
  message: z.string().trim().min(10, "Enter a message of at least 10 characters.").max(3000),
  consent: z.literal(true, { error: "Confirm that the school may contact you." }),
  turnstileToken: z.string().trim().min(10, "Complete the security check.").max(4096),
});

export const dataRightsRequestSchema = z.object({
  requestType: z.enum(["access", "correction", "erasure", "withdraw_consent"]),
  requesterName: personNameSchema,
  contactEmail: z.email().trim().max(254),
  studentName: personNameSchema,
  description: z.string().trim().min(10, "Describe your request in at least 10 characters.").max(1500),
  guardianConfirmation: z.literal(true, { error: "Confirm that you are authorized to make this request." }),
});

export const wrongRecordReportSchema = z.object({
  name: personNameSchema,
  session: z.string().trim().regex(/^\d{4}-\d{2}$/, "Choose a valid passing session."),
  issue: z.string().trim().min(10, "Describe the issue in at least 10 characters.").max(2000),
  email: z.email().trim().max(254),
  contact: z.string().trim().min(5).max(254),
  contactMethod: z.enum(["email", "phone"]),
  phoneOptIn: z.boolean(),
  phoneNumber: z.string().trim().max(24).optional(),
  consent: z.literal(true, { error: "Confirm that the School may review this report." }),
  turnstileToken: z.string().trim().min(10, "Complete the security check.").max(4096),
}).superRefine((value, context) => {
  if (value.contactMethod === "email" && !z.email().safeParse(value.contact).success)
    context.addIssue({ code: "custom", path: ["contact"], message: "Enter a valid email address." });
  if (value.contactMethod === "phone" && !isValidPhoneNumber(value.contact))
    context.addIssue({ code: "custom", path: ["contact"], message: "Enter a valid phone number." });
  if (value.phoneOptIn && !isValidPhoneNumber(value.phoneNumber ?? ""))
    context.addIssue({ code: "custom", path: ["phoneNumber"], message: "Enter a valid phone number when opting in." });
  if (value.contactMethod === "phone" && value.phoneOptIn)
    context.addIssue({ code: "custom", path: ["phoneOptIn"], message: "Optional phone follow-up is only available with email contact." });
  if (!value.phoneOptIn && value.phoneNumber)
    context.addIssue({ code: "custom", path: ["phoneNumber"], message: "Phone number requires explicit opt-in." });
});

export const studentLookupSchema = z.object({
  studentName: personNameSchema,
  fatherName: personNameSchema,
  motherName: personNameSchema,
  className: z.string().trim().min(1).max(40).regex(/^[\p{L}\p{M}\p{N} ./'-]+$/u),
  scholarNumber: z.string().trim().min(1).max(40).regex(/^[\p{L}\p{M}\p{N} /-]+$/u),
  session: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Choose a valid passing session."),
  consent: z.literal(true, { error: "Confirm the consent statement to continue." }),
  turnstileToken: z.string().trim().min(1, "Complete the security check."),
});

export const studentCreateSchema = z.object({
  admissionNo: z.string().trim().max(80).optional(),
  admissionNumber: z.string().trim().max(80).optional(),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Enter a valid date of birth.")
    .optional()
    .or(z.literal("")),
  studentName: personNameSchema,
  fatherName: personNameSchema,
  motherName: personNameSchema,
  className: z.string().trim().min(1).max(40).regex(/^[\p{L}\p{M}\p{N} ./'-]+$/u),
  scholarNumber: z.string().trim().min(1).max(40).regex(/^[\p{L}\p{M}\p{N} /-]+$/u),
  session: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/),
  certificateType: z.string().trim().min(2).max(60),
  certificateNumber: z.string().trim().min(1).max(80),
  issuedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export const studentUpdateSchema = studentCreateSchema.pick({
  studentName: true,
  fatherName: true,
  motherName: true,
  className: true,
  scholarNumber: true,
  session: true,
  admissionNumber: true,
  dateOfBirth: true,
});

export const studentDisambiguationSchema = z.object({
  challengeToken: z.string().min(20).max(2048),
  disambiguationValue: z.string().trim().min(1).max(100),
});

export const certificateMetadataSchema = z.object({
  session: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/),
  type: z.string().trim().min(2).max(60),
  certificateNumber: z.string().trim().min(1).max(80),
  issueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const catalogItemSchema = z
  .object({
    id: z.string().trim().min(1).max(80).optional(),
    label: z.string().trim().min(2).max(80).optional(),
    name: z.string().trim().min(2).max(80).optional(),
  })
  .refine(
    (value) => Boolean(value.label ?? value.name),
    "A catalog label is required.",
  );

export const dataRightsResolutionSchema = z.object({
  id: z.string().trim().min(1).max(160),
  resolution: z.string().trim().min(1).max(2000),
});

const optionalProfileDate = z.string().max(10).refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date.").default("");

export const adminInviteProfileSchema = z.object({
  name: personNameSchema,
  preferredName: z.string().trim().max(80).default(""),
  staffId: z.string().trim().max(50).default(""),
  gender: z.enum(["", "female", "male", "nonbinary", "prefer-not-to-say", "self-described"]).default(""),
  dateOfBirth: optionalProfileDate,
  position: z.string().trim().max(120).default(""),
  department: z.string().trim().max(120).default(""),
  designation: z.string().trim().max(120).default(""),
  campus: z.string().trim().max(120).default(""),
  joiningDate: optionalProfileDate,
  reportingManager: z.string().trim().max(100).default(""),
  officeLocation: z.string().trim().max(160).default(""),
  alternateEmail: z.union([z.email().trim().max(254), z.literal("")]).default(""),
  primaryPhone: optionalPhoneSchema.default(""),
  secondaryPhone: optionalPhoneSchema.default(""),
  address: z.string().trim().max(500).default(""),
  emergencyContactName: z.string().trim().max(100).default(""),
  emergencyContactPhone: optionalPhoneSchema.default(""),
}).strict();

export const adminInviteSchema = z.object({
  email: z.email().trim().max(254),
  role: z.enum(["uploader", "approver", "admin", "superadmin"]).default("uploader"),
  profile: adminInviteProfileSchema,
});

export const adminStatusSchema = z.object({
  uid: z.string().trim().min(1).max(128),
  disabled: z.boolean(),
});

export const certificateUploadMetadataSchema = z.object({
  session: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/),
  type: z.string().trim().min(2).max(60),
  certificateNumber: z.string().trim().min(1).max(80),
  issueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  studentId: z.string().trim().min(1).max(160),
});

export const auditFilterSchema = z
  .object({
    start: z.iso.datetime({ offset: true }).optional(),
    end: z.iso.datetime({ offset: true }).optional(),
    action: z.string().trim().max(100).optional(),
  })
  .refine(
    (value) => !value.start || !value.end || value.start <= value.end,
    "Invalid date range.",
  );

export const documentIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
