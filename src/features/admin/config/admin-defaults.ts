import type {
  AnnouncementState,
  FaqItem,
  NotifyState,
  StudentFormState,
} from "../types/admin-state.types";

export const createDefaultFaqs = (): FaqItem[] => [
  {
    questionEn: "Name not found",
    answerEn:
      "Check that the student's name and both parents' names match the school register, including spaces and spelling. If the record still does not appear, submit a report for review.",
  },
  {
    questionEn: "Which spelling should I use?",
    answerEn: "Use the exact spelling recorded in the school's admission or examination records.",
  },
  {
    questionEn: "Wrong details in my certificate",
    answerEn:
      "Submit a wrong-record report with the session, incorrect detail and a contact method.",
  },
  {
    questionEn: "I passed in a different session",
    answerEn:
      "Choose the session in which you passed. If it is not listed, contact the school office.",
  },
  {
    questionEn: "Is my data safe? (DPDP)",
    answerEn:
      "Your details are used to match school records and provide the requested certificate. See the Privacy page for data-rights and grievance information.",
  },
  {
    questionEn: "How do I verify a certificate as an employer?",
    answerEn:
      "Open Verify and enter the certificate number. The result confirms whether the certificate record is valid, revoked or unavailable.",
  },
  {
    questionEn: "Can I get a hard copy?",
    answerEn:
      "Contact the school office using the support details in the footer. Availability and any applicable fee are decided by the school.",
  },
];

export const createDefaultStudentForm = (): StudentFormState => ({
  admissionNumber: "",
  dateOfBirth: "",
  studentName: "",
  fatherName: "",
  motherName: "",
  className: "",
  scholarNumber: "",
  session: "",
  certificateType: "",
  certificateNumber: "",
  issuedAt: "",
});

export const createDefaultNotify = (): NotifyState => ({
  email: "",
  mobile: "",
  consent: false,
});

export const createDefaultAnnouncement = (): AnnouncementState => ({
  enabled: false,
  type: "info",
  textEn: "",
  text_i18n: {},
  linkUrl: "",
  startAt: "",
  endAt: "",
});
