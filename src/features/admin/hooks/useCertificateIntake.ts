import { useCallback, useEffect, useMemo, useState, type FormEvent, type Dispatch, type SetStateAction } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

import { createDefaultNotify, createDefaultStudentForm } from "../config/admin-defaults";
import { csrf } from "../utils/admin-helpers";

import type { CatalogOption, NotifyState, StudentFormState } from "../types/admin-state.types";
import type { Student, Role, Tab } from "../types/admin.types";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(url: string, init?: RequestInit) => Promise<T>;
type Props = {
  api: Api; act: (fn: () => Promise<void>) => Promise<void>; setToast: Dispatch<SetStateAction<string>>;
  tab: Tab; load: () => Promise<void>;
};

export function useCertificateIntake({ api, act, setToast, tab, load }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [sessionOptions, setSessionOptions] = useState<CatalogOption[]>([]);
  const [typeOptions, setTypeOptions] = useState<CatalogOption[]>([]);
  const [classOptions, setClassOptions] = useState<CatalogOption[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<StudentFormState>(createDefaultStudentForm());
  const [selectedStudent, setSelectedStudent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [duplicateHashAcknowledged, setDuplicateHashAcknowledged] = useState(false);
  const [duplicateHashReason, setDuplicateHashReason] = useState("");
  const [duplicateHashWarning, setDuplicateHashWarning] = useState("");
  const [notify, setNotify] = useState<NotifyState>(createDefaultNotify());
  const loadStudents = useCallback(async () => {
    const all: Student[] = [];
    let cursor = "";
    do {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const page = await api<{ students: Student[]; hasMore?: boolean; nextCursor?: string | null }>(`/api/admin/students/list${query}`);
      all.push(...(page.students ?? []));
      cursor = page.hasMore && page.nextCursor ? page.nextCursor : "";
    } while (cursor);
    setStudents(all);
  }, [api]);
  useEffect(() => {
    if (tab === "certificates" && !selectedStudent && students.length)
      setSelectedStudent(students[0]!.id);
  }, [tab, selectedStudent, students]);
  useEffect(() => {
    if (tab !== "certificates" || !selectedStudent) return;
    const studentSession = students.find((student) => student.id === selectedStudent)?.session;
    if (studentSession)
      setForm((current) => current.session === studentSession
        ? current
        : { ...current, session: studentSession });
  }, [tab, selectedStudent, students, setForm]);
  const filtered = useMemo(
    () =>
      students.filter((s) =>
        [s.admissionNo, s.scholarNumber, s.studentName, s.fatherName, s.motherName, s.className, s.session]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [students, search],
  );
  const visible = filtered.slice(page * 10, page * 10 + 10);
  async function addStudent(e: FormEvent) {
    e.preventDefault();
    let duplicateWarning = "";
    await act(async () => {
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) body.append(k, String(v));
      const firstFile = files.at(0);
      if (firstFile instanceof File) body.append("file", firstFile);
      body.append("parentEmail", notify.email);
      body.append("parentMobile", notify.mobile);
      body.append("notificationConsent", String(notify.consent));
      body.append("confirmDuplicateHash", String(duplicateHashAcknowledged));
      body.append("duplicateHashReason", duplicateHashReason);
      const response = await fetch("/api/admin/students", {
        method: "POST",
        body,
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.duplicateFileWarning === true)
          setDuplicateHashWarning(String(result.error ?? "Duplicate file detected."));
        throw new Error(
          typeof result.error === "string" ? result.error : "Student/certificate save failed.",
        );
      }
      duplicateWarning = typeof result.warning === "string" ? result.warning : "";
      setForm({
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
      setNotify({ email: "", mobile: "", consent: false });
      setDuplicateHashAcknowledged(false);
      setDuplicateHashReason("");
      setDuplicateHashWarning("");
      await loadStudents();
    });
    if (duplicateWarning) setToast(duplicateWarning);
  }
  async function removeStudent(s: Student) {
    if (
      !confirm(
        `Delete ${s.studentName} and all ${s.certificateCount} linked certificate files? This cannot be undone.`,
      )
    )
      return;
    await act(async () => {
      await api(`/api/admin/students/${s.id}`, { method: "DELETE" });
      await loadStudents();
    });
  }
  async function uploadMany(e: FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !files.length) return;
    await act(async () => {
      const f = new FormData();
      f.append("studentId", selectedStudent);
      f.append("session", form.session);
      f.append("certificateType", form.certificateType);
      f.append("certificateNumber", form.certificateNumber);
      f.append("issuedAt", form.issuedAt);
      f.append("confirmDuplicateHash", String(duplicateHashAcknowledged));
      f.append("duplicateHashReason", duplicateHashReason);
      const firstFile = files[0];
      if (!(firstFile instanceof File)) throw new Error("Select a certificate file.");
      f.append("file", firstFile);
      const response = await fetch("/api/admin/certificates", {
        method: "POST",
        body: f,
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.duplicateFileWarning === true)
          setDuplicateHashWarning(String(data.error ?? "Duplicate file detected."));
        throw new Error(String(data.error ?? "Certificate upload failed."));
      }
      setFiles([]);
      setDuplicateHashAcknowledged(false);
      setDuplicateHashReason("");
      setDuplicateHashWarning("");
      await load();
    });
  }
  return {
    students, setStudents, sessionOptions, setSessionOptions, typeOptions, setTypeOptions, classOptions, setClassOptions,
    search, setSearch, page, setPage, form, setForm, selectedStudent, setSelectedStudent, files, setFiles,
    duplicateHashAcknowledged, setDuplicateHashAcknowledged, duplicateHashReason, setDuplicateHashReason,
    duplicateHashWarning, setDuplicateHashWarning, notify, setNotify, loadStudents, filtered, visible,
    addStudent, removeStudent, uploadMany,
  };
}
