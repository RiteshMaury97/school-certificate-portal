import { z } from "zod";

const personName = z
  .string()
  .trim()
  .min(2, "Enter at least 2 characters.")
  .max(100, "Maximum 100 characters.")
  .regex(
    /^[\p{L}\p{M} .'-]+$/u,
    "Use letters, spaces, apostrophes, periods or hyphens only.",
  );

export const studentLookupSchema = z.object({
  studentName: personName,
  fatherName: personName,
  motherName: personName,
  session: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Choose a valid passing session."),
  consent: z.literal(true),
  turnstileToken: z.string().min(1),
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
  studentName: personName,
  fatherName: personName,
  motherName: personName,
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

export const adminInviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["uploader", "approver", "superadmin"]).default("uploader"),
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
    start: z.string().datetime({ offset: true }).optional(),
    end: z.string().datetime({ offset: true }).optional(),
    action: z.string().trim().max(100).optional(),
  })
  .refine(
    (value) => !value.start || !value.end || value.start <= value.end,
    "Invalid date range.",
  );

export const documentIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
