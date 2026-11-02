import { useCallback, useState, type Dispatch, type SetStateAction, type SubmitEvent } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";
import { confirmAction } from "@/shared/admin-dialogs";

import { createDefaultNotify, createDefaultStudentForm } from "../config/admin-defaults";
import { csrf } from "../utils/admin-helpers";

import type { CatalogOption, NotifyState, StudentFormState } from "../types/admin-state.types";
import type { Student, Tab } from "../types/admin.types";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type Props = {
  api: Api;
  act: (fn: () => Promise<void>) => Promise<void>;
  setToast: Dispatch<SetStateAction<string>>;
  tab: Tab;
  load: () => Promise<void>;
};

type ApiResponse = Record<string, unknown>;

function isRecord(value: unknown): value is ApiResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readResponse(response: Response): Promise<ApiResponse> {
  const value: unknown = await response.json().catch(() => ({}));
  return isRecord(value) ? value : {};
}

function checkResponse(
  response: Response,
  data: ApiResponse,
  fallback: string,
  setWarning: Dispatch<SetStateAction<string>>,
) {
  if (response.ok) return;
  if (data.duplicateFileWarning === true)
    setWarning(typeof data.error === "string" ? data.error : "Duplicate file detected.");
  throw new Error(typeof data.error === "string" ? data.error : fallback);
}

async function fetchStudents(api: Api): Promise<Student[]> {
  const all: Student[] = [];
  let cursor = "";
  do {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const result = await api<{
      students: Student[];
      hasMore?: boolean;
      nextCursor?: string | null;
    }>(`/api/admin/students/list${query}`);
    all.push(...result.students);
    cursor = result.hasMore && result.nextCursor ? result.nextCursor : "";
  } while (cursor);
  return all;
}

type StudentSubmission = Pick<Props, "act" | "setToast"> & {
  form: StudentFormState;
  files: File[];
  notify: NotifyState;
  duplicateHashAcknowledged: boolean;
  duplicateHashReason: string;
  setForm: Dispatch<SetStateAction<StudentFormState>>;
  setNotify: Dispatch<SetStateAction<NotifyState>>;
  setDuplicateHashAcknowledged: Dispatch<SetStateAction<boolean>>;
  setDuplicateHashReason: Dispatch<SetStateAction<string>>;
  setDuplicateHashWarning: Dispatch<SetStateAction<string>>;
  loadStudents: () => Promise<void>;
};

async function submitStudent(e: SubmitEvent<HTMLFormElement>, input: StudentSubmission) {
  e.preventDefault();
  let duplicateWarning = "";
  await input.act(async () => {
    const body = new FormData();
    for (const [key, value] of Object.entries(input.form)) body.append(key, value);
    const firstFile = input.files.at(0);
    if (firstFile instanceof File) body.append("file", firstFile);
    body.append("parentEmail", input.notify.email);
    body.append("parentMobile", input.notify.mobile);
    body.append("notificationConsent", String(input.notify.consent));
    body.append("confirmDuplicateHash", String(input.duplicateHashAcknowledged));
    body.append("duplicateHashReason", input.duplicateHashReason);
    const response = await fetch("/api/admin/students", {
      method: "POST",
      body,
      headers: { "x-csrf-token": decodeURIComponent(csrf()), ...(await appCheckHeaders()) },
    });
    const result = await readResponse(response);
    checkResponse(
      response,
      result,
      "Student/certificate save failed.",
      input.setDuplicateHashWarning,
    );
    duplicateWarning = typeof result.warning === "string" ? result.warning : "";
    input.setForm(createDefaultStudentForm());
    input.setNotify(createDefaultNotify());
    input.setDuplicateHashAcknowledged(false);
    input.setDuplicateHashReason("");
    input.setDuplicateHashWarning("");
    await input.loadStudents();
  });
  if (duplicateWarning) input.setToast(duplicateWarning);
}

async function deleteStudent(api: Api, loadStudents: () => Promise<void>, student: Student) {
  const accepted = await confirmAction(
    "Delete student record",
    `Delete ${student.studentName} and all ${String(student.certificateCount)} linked certificate files? This cannot be undone.`,
    "Delete record",
  );
  if (!accepted) return;
  await api(`/api/admin/students/${student.id}`, { method: "DELETE" });
  await loadStudents();
}

type CertificateSubmission = Pick<Props, "act" | "load"> & {
  selectedStudent: string;
  form: StudentFormState;
  files: File[];
  duplicateHashAcknowledged: boolean;
  duplicateHashReason: string;
  setFiles: Dispatch<SetStateAction<File[]>>;
  setDuplicateHashAcknowledged: Dispatch<SetStateAction<boolean>>;
  setDuplicateHashReason: Dispatch<SetStateAction<string>>;
  setDuplicateHashWarning: Dispatch<SetStateAction<string>>;
};

async function submitCertificates(e: SubmitEvent<HTMLFormElement>, input: CertificateSubmission) {
  e.preventDefault();
  if (!input.selectedStudent || !input.files.length) return;
  await input.act(async () => {
    const body = new FormData();
    body.append("studentId", input.selectedStudent);
    body.append("session", input.form.session);
    body.append("certificateType", input.form.certificateType);
    body.append("certificateNumber", input.form.certificateNumber);
    body.append("issuedAt", input.form.issuedAt);
    body.append("confirmDuplicateHash", String(input.duplicateHashAcknowledged));
    body.append("duplicateHashReason", input.duplicateHashReason);
    const firstFile = input.files[0];
    if (!(firstFile instanceof File)) throw new Error("Select a certificate file.");
    body.append("file", firstFile);
    const response = await fetch("/api/admin/certificates", {
      method: "POST",
      body,
      headers: { "x-csrf-token": decodeURIComponent(csrf()), ...(await appCheckHeaders()) },
    });
    const data = await readResponse(response);
    checkResponse(response, data, "Certificate upload failed.", input.setDuplicateHashWarning);
    input.setFiles([]);
    input.setDuplicateHashAcknowledged(false);
    input.setDuplicateHashReason("");
    input.setDuplicateHashWarning("");
    await input.load();
  });
}

export function useCertificateIntake({ api, act, setToast, tab, load }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [sessionOptions, setSessionOptions] = useState<CatalogOption[]>([]);
  const [typeOptions, setTypeOptions] = useState<CatalogOption[]>([]);
  const [classOptions, setClassOptions] = useState<CatalogOption[]>([]);
  const [form, setForm] = useState<StudentFormState>(createDefaultStudentForm());
  const [selectedStudentState, setSelectedStudentState] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [duplicateHashAcknowledged, setDuplicateHashAcknowledged] = useState(false);
  const [duplicateHashReason, setDuplicateHashReason] = useState("");
  const [duplicateHashWarning, setDuplicateHashWarning] = useState("");
  const [notify, setNotify] = useState<NotifyState>(createDefaultNotify());
  const [selectedStudent, setSelectedStudentStateValue] = [
    selectedStudentState || (tab === "certificates" ? (students[0]?.id ?? "") : ""),
    setSelectedStudentState,
  ] as const;
  const setSelectedStudent: Dispatch<SetStateAction<string>> = useCallback(
    (value) => {
      setSelectedStudentStateValue(value);
      if (typeof value === "string") {
        const session = students.find((student) => student.id === value)?.session;
        if (session) setForm((current) => ({ ...current, session }));
      }
    },
    [students, setSelectedStudentStateValue],
  );
  const loadStudents = useCallback(async () => {
    setStudents(await fetchStudents(api));
  }, [api]);
  const addStudent = (e: SubmitEvent<HTMLFormElement>) =>
    submitStudent(e, {
      act,
      setToast,
      form,
      files,
      notify,
      duplicateHashAcknowledged,
      duplicateHashReason,
      setForm,
      setNotify,
      setDuplicateHashAcknowledged,
      setDuplicateHashReason,
      setDuplicateHashWarning,
      loadStudents,
    });
  const removeStudent = (student: Student) => act(() => deleteStudent(api, loadStudents, student));
  const uploadMany = (e: SubmitEvent<HTMLFormElement>) =>
    submitCertificates(e, {
      act,
      load,
      selectedStudent,
      form,
      files,
      duplicateHashAcknowledged,
      duplicateHashReason,
      setFiles,
      setDuplicateHashAcknowledged,
      setDuplicateHashReason,
      setDuplicateHashWarning,
    });
  return {
    students,
    setStudents,
    sessionOptions,
    setSessionOptions,
    typeOptions,
    setTypeOptions,
    classOptions,
    setClassOptions,
    form,
    setForm,
    selectedStudent,
    setSelectedStudent,
    files,
    setFiles,
    duplicateHashAcknowledged,
    setDuplicateHashAcknowledged,
    duplicateHashReason,
    setDuplicateHashReason,
    duplicateHashWarning,
    setDuplicateHashWarning,
    notify,
    setNotify,
    loadStudents,
    addStudent,
    removeStudent,
    uploadMany,
  };
}
