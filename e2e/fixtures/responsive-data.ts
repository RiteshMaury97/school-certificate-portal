export type ResponsiveScenario = "empty" | "normal" | "worst";

export type ResponsiveStudent = {
  id: string;
  admissionNo: string;
  studentName: string;
  fatherName: string;
  motherName: string;
  email: string;
  session: string;
  className: string;
  certificateCount: number;
};

export type ResponsiveCertificate = {
  id: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  email: string;
  session: string;
  type: string;
  certificateNumber: string;
  issueDate: string;
  fileName: string;
  status: "published" | "pending";
  uploadedBy: string;
};

const longName = "Aarav " + "VeryLongStudentName".repeat(3);
const longEmail = `${"verylongaddress".repeat(4)}@example.school.test`;
const longCertificateNumber = `CERT-${"2026-LONG-NUMBER-".repeat(2)}-0001`;

export function studentsFor(scenario: ResponsiveScenario): ResponsiveStudent[] {
  if (scenario === "empty") return [];
  const count = scenario === "worst" ? 500 : 3;
  return Array.from({ length: count }, (_, index) => ({
    id: `student-${String(index).padStart(4, "0")}`,
    admissionNo:
      scenario === "worst" ? `ADM-${String(index).padStart(6, "0")}` : `10${String(index + 1)}`,
    studentName:
      scenario === "worst"
        ? longName
        : (["Rahul Kumar", "Aarav Patel", "Sana Khan"][index % 3] ?? "Rahul Kumar"),
    fatherName: scenario === "worst" ? longName : "Amit Kumar",
    motherName: scenario === "worst" ? longName : "Sunita Kumar",
    email: scenario === "worst" ? longEmail : `student${String(index + 1)}@example.test`,
    session: "2025-26",
    className: "Class 10",
    certificateCount: scenario === "worst" ? 20 : 1,
  }));
}

export function certificatesFor(scenario: ResponsiveScenario): ResponsiveCertificate[] {
  if (scenario === "empty") return [];
  const count = scenario === "worst" ? 20 : 3;
  return Array.from({ length: count }, (_, index) => ({
    id: `certificate-${String(index).padStart(4, "0")}`,
    studentId: `student-${String(index).padStart(4, "0")}`,
    studentName:
      scenario === "worst"
        ? longName
        : (["Rahul Kumar", "Aarav Patel", "Sana Khan"][index % 3] ?? "Rahul Kumar"),
    admissionNo: `ADM-${String(index + 1).padStart(6, "0")}`,
    email: scenario === "worst" ? longEmail : `student${String(index + 1)}@example.test`,
    session: "2025-26",
    type: "Marksheet",
    certificateNumber:
      scenario === "worst"
        ? longCertificateNumber
        : `CERT-2025-${String(index + 1).padStart(4, "0")}`,
    issueDate: "2026-04-15",
    fileName: "marksheet.pdf",
    status: "pending",
    uploadedBy: "responsive.audit@example.test",
  }));
}

export function siteSettingsFor(scenario: ResponsiveScenario) {
  return {
    schoolName: scenario === "worst" ? longName : "Satyam International School",
    tagline: "Learning for life",
    address: scenario === "worst" ? `${longName} हिंदी माध्यम विद्यालय` : "School Road, India",
    phone: "+910000000000",
    email: scenario === "worst" ? longEmail : "office@example.test",
    boardName: "CBSE",
    affiliationNumber: "123456",
    schoolCode: "SI-001",
    principalName: scenario === "worst" ? longName : "Principal Test",
    principalMessage:
      scenario === "worst"
        ? "यह विद्यालय छात्रों के उज्ज्वल भविष्य के लिए समर्पित है। ".repeat(8)
        : "Welcome to our school.",
    principalPhotoUrl: "",
    announcement: { type: "info", textEn: "Admissions information", linkUrl: "" },
    socialLinks: [],
    lastUpdated: "31 October 2026",
    faqs: [
      { questionEn: "How do I find certificates?", answerEn: "Use the certificate search page." },
    ],
  };
}
