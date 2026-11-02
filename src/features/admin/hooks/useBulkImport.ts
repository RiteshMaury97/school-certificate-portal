import { useState, type Dispatch, type SetStateAction } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";
import { confirmAction } from "@/shared/admin-dialogs";

import { csrf } from "../utils/admin-helpers";

import type {
  StudentImportCellError,
  StudentImportPreview,
  StudentImportRow,
} from "../types/admin-state.types";

type Props = {
  act: (fn: () => Promise<void>) => Promise<void>;
  loadStudents: () => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isCellError(value: unknown): value is StudentImportCellError {
  return isRecord(value) && typeof value.column === "string" && typeof value.message === "string";
}

function isImportRow(value: unknown): value is StudentImportRow {
  return (
    isRecord(value) &&
    typeof value.row === "number" &&
    (value.data === null || isStringRecord(value.data)) &&
    isStringRecord(value.values) &&
    (typeof value.error === "string" || value.error === null) &&
    Array.isArray(value.fieldErrors) &&
    value.fieldErrors.every(isCellError)
  );
}

function isImportPreview(value: unknown): value is StudentImportPreview {
  return (
    isRecord(value) &&
    typeof value.total === "number" &&
    typeof value.valid === "number" &&
    Array.isArray(value.errors) &&
    value.errors.every(isImportRow) &&
    Array.isArray(value.preview) &&
    value.preview.every(isImportRow)
  );
}

async function responseData(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => ({}));
  if (!isRecord(value)) throw new Error("The import service returned an invalid response.");
  return value;
}

export function useBulkImport({ act, loadStudents }: Props) {
  const [file, setFileState] = useState<File | null>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);

  function setFile(nextFile: File | null) {
    setFileState(nextFile);
    setPreview(null);
  }

  async function importStudents(action: "preview" | "commit") {
    if (!file) return;
    if (
      action === "commit" &&
      !(await confirmAction(
        "Import validated students",
        "Import all validated student rows now?",
        "Import students",
      ))
    )
      return;

    await act(async () => {
      const body = new FormData();
      body.append("file", file);
      body.append("action", action);
      const response = await fetch("/api/admin/students/import", {
        method: "POST",
        body,
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
      const result = await responseData(response);
      if (!response.ok)
        throw new Error(typeof result.error === "string" ? result.error : "Student import failed.");

      if (action === "preview") {
        if (!isImportPreview(result)) throw new Error("The import preview response is incomplete.");
        setPreview(result);
        return;
      }

      if (result.ok !== true) throw new Error("The import service did not confirm the import.");
      setPreview(null);
      setFileState(null);
      await loadStudents();
    });
  }

  async function downloadTemplate() {
    await act(async () => {
      const response = await fetch("/api/admin/templates?format=xlsx", {
        headers: await appCheckHeaders(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Excel template download failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "student-import-template.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  return { file, setFile, preview, importStudents, downloadTemplate };
}
