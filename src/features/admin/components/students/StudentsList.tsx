import { Search, ShieldCheck, UsersRound } from "lucide-react";

import EmptyState from "@/components/feedback/EmptyState";

import type { Role, Student, Tab } from "../../types/admin.types";
import type { Dispatch, SetStateAction } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(url: string, init?: RequestInit) => Promise<T>;
type Props = {
  role: Role; visible: Student[]; filtered: Student[]; search: string; setSearch: Dispatch<SetStateAction<string>>;
  page: number; setPage: Dispatch<SetStateAction<number>>; setTimelineStudentId: Dispatch<SetStateAction<string>>;
  setTab: (tab: Tab) => void; act: (fn: () => Promise<void>) => Promise<void>; api: Api;
  loadStudents: () => Promise<void>; removeStudent: (student: Student) => Promise<void>;
  setSelectedStudent: Dispatch<SetStateAction<string>>;
};

export default function StudentsList(props: Props) {
  const { role, visible, filtered, search, setSearch, page, setPage, setTimelineStudentId, setTab, setSelectedStudent, act, api, loadStudents, removeStudent } = props;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));

  return (
    <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]"><UsersRound size={18} aria-hidden="true" /></span>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Students</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{filtered.length} {filtered.length === 1 ? "record" : "records"}</p>
          </div>
        </div>
        <label htmlFor="student-search" className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search by name, scholar number, class or admission number</span>
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input id="student-search" aria-label="Search students" translate="no" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Name, class, scholar no. or admission no." className="min-h-10 w-full rounded-lg border border-[var(--divider)] bg-[var(--surface)] pl-9 pr-3 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-y border-[var(--divider)] py-3 text-[10px] text-[var(--text-muted)]">
        <span>All sessions</span>
        <span>Student records are private to authorized administrators</span>
      </div>

      <div className="mt-4 space-y-3">
        {visible.length === 0 && (
          <EmptyState
            icon={<UsersRound size={20} />}
            title={search ? "No matching students" : "No students yet"}
            description={search ? "Try a different name or admission number." : "Your student directory is ready. Add a student manually or import existing records to get started."}
            action={!search && role !== "approver" ? (
              <button type="button" onClick={() => document.getElementById("student-create-form")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]">Add first student</button>
            ) : undefined}
          />
        )}
        {visible.map((student) => (
          <article key={student.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--divider)] p-3 transition hover:bg-[var(--surface-2)]">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text)]">{student.studentName}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Parents: {student.fatherName} / {student.motherName} <span className="px-1">·</span> Class {student.className || "Needs update"} <span className="px-1">·</span> {student.session}</p>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">Scholar no. {student.scholarNumber || "Needs update"} · {student.admissionNo ? `Admission no. ${student.admissionNo} · ` : ""}{student.certificateCount} certificates</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setTimelineStudentId(student.id); setTab("timeline"); }} className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium text-[var(--text)]">Timeline</button>
              {role !== "approver" && <button type="button" onClick={() => { setSelectedStudent(student.id); setTab("certificates"); }} className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium text-[var(--text)]">Add certificate</button>}
              {role !== "approver" && <button type="button" onClick={() => { void editStudent(student, api, act, loadStudents); }} className="min-h-9 rounded-lg border border-[var(--divider)] px-3 text-xs font-medium text-[var(--text)]">Edit</button>}
              {role === "superadmin" && <button type="button" onClick={() => void removeStudent(student)} className="min-h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--danger)]">Delete</button>}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--divider)] pt-3 text-xs">
        <span className="text-[var(--text-muted)]">Showing {filtered.length === 0 ? 0 : page * 10 + 1}–{Math.min((page + 1) * 10, filtered.length)} of {filtered.length} students</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page === 0} onClick={() => { setPage((value) => value - 1); }} className="min-h-8 rounded-md border border-[var(--divider)] px-2.5 disabled:opacity-40">Previous</button>
          <span className="text-[var(--text-muted)]">Page {page + 1} of {pageCount}</span>
          <button type="button" disabled={(page + 1) * 10 >= filtered.length} onClick={() => { setPage((value) => value + 1); }} className="min-h-8 rounded-md border border-[var(--divider)] px-2.5 disabled:opacity-40">Next</button>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-lg bg-[var(--surface-2)] p-3">
        <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--primary)]" />
        <div><p className="text-xs font-semibold text-[var(--text)]">Protected student records</p><p className="mt-1 text-[10px] leading-4 text-[var(--text-muted)]">Only authorized administrators can view or manage student information. Changes are logged.</p></div>
      </div>
    </section>
  );
}

async function editStudent(
  student: Student,
  api: Api,
  act: Props["act"],
  loadStudents: Props["loadStudents"],
) {
  let requiredValues: {
    studentName: string;
    fatherName: string;
    motherName: string;
    className: string;
    scholarNumber: string;
    session: string;
  };
  try {
    requiredValues = {
      studentName: promptRequired("Student name", student.studentName),
      fatherName: promptRequired("Father name", student.fatherName),
      motherName: promptRequired("Mother name", student.motherName),
      className: promptRequired("Class / section", student.className),
      scholarNumber: promptRequired("Scholar number", student.scholarNumber),
      session: promptRequired("Session (YYYY-YY)", student.session),
    };
  } catch (error) {
    if (error === promptCancelled) return;
    if (error instanceof Error) throw error;
    throw new Error("Unable to edit student details.");
  }
  const { studentName, fatherName, motherName, className, scholarNumber, session } =
    requiredValues;
  const admissionNumber = prompt("Admission number (leave blank if unavailable)", student.admissionNo) ?? "";
  const dateOfBirth = prompt("Date of birth (YYYY-MM-DD; leave blank if unavailable)", student.dateOfBirth) ?? "";
  await act(async () => {
    await api(`/api/admin/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentName, fatherName, motherName, className, scholarNumber, session, admissionNumber, dateOfBirth }),
    });
    await loadStudents();
  });
}

const promptCancelled = new Error("Student edit cancelled.");

function promptRequired(label: string, initialValue: string): string {
  const value = prompt(label, initialValue);
  if (!value) throw promptCancelled;
  return value;
}
