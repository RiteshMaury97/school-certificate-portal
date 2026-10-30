"use client";
import { useState, type FormEvent } from "react";
export type CertificateSearchValues = {
  studentName: string;
  fatherName: string;
  motherName: string;
  session: string;
};
export default function SearchForm({
  onSearch,
}: {
  onSearch: (values: CertificateSearchValues) => void;
}) {
  const [values, setValues] = useState<CertificateSearchValues>({
    studentName: "",
    fatherName: "",
    motherName: "",
    session: "",
  });
  function update(key: keyof CertificateSearchValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(values);
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {(["studentName", "fatherName", "motherName", "session"] as const).map((key) => (
        <label key={key} className="text-sm font-semibold">
          {
            {
              studentName: "Student name",
              fatherName: "Father's name",
              motherName: "Mother's name",
              session: "Session",
            }[key]
          }
          <input
            translate="no"
            required
            value={values[key]}
            onChange={(e) => update(key, e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3 text-base"
          />
        </label>
      ))}
      <button className="min-h-11 rounded-lg bg-[var(--primary)] px-4 font-semibold text-[var(--primary-contrast)] sm:col-span-2">
        Find certificates
      </button>
    </form>
  );
}
