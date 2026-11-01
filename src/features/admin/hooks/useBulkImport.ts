import { useState, type SubmitEvent, type Dispatch, type SetStateAction } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

import { csrf } from "../utils/admin-helpers";

import type { BulkPreviewItem } from "../types/admin-state.types";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type Props = {
  api: Api;
  act: (fn: () => Promise<void>) => Promise<void>;
  setError: Dispatch<SetStateAction<string>>;
  load: () => Promise<void>;
  loadStudents: () => Promise<void>;
  duplicateHashAcknowledged: boolean;
  duplicateHashReason: string;
  setDuplicateHashWarning: Dispatch<SetStateAction<string>>;
};

export function useBulkImport({
  api,
  act,
  setError,
  load,
  loadStudents,
  duplicateHashAcknowledged,
  duplicateHashReason,
  setDuplicateHashWarning,
}: Props) {
  const [csv, setCsv] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkCsv, setBulkCsv] = useState<File | null>(null);
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewItem[]>([]);
  const [bulkProgress, setBulkProgress] = useState<Record<string, number>>({});
  async function importCsv(action: "preview" | "commit") {
    if (!csv) return;
    if (action === "commit" && !confirm("Import all validated student rows now?")) return;
    await act(async () => {
      const f = new FormData();
      f.append("file", csv);
      f.append("action", action);
      const response = await fetch("/api/admin/students/import", {
        method: "POST",
        body: f,
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
      const d = await response.json();
      setPreview(d);
      if (!response.ok) throw new Error(d.error ?? "CSV import failed.");
      if (action === "commit") await loadStudents();
    });
  }
  async function previewBulk() {
    if (!bulkCsv || !bulkFiles.length) {
      setError("Select certificate files and a mapping CSV first.");
      return;
    }
    await act(async () => {
      const body = new FormData();
      body.append("mappingCsv", bulkCsv);
      body.append(
        "fileManifest",
        JSON.stringify(bulkFiles.map((file) => ({ name: file.name, size: file.size }))),
      );
      const result = await api<{
        preview: {
          fileName: string;
          size: number;
          valid: boolean;
          errors: string[];
          mapping: Record<string, string> | null;
        }[];
      }>("/api/admin/bulk-upload/preview", { method: "POST", body });
      setBulkPreview(result.preview ?? []);
      setBulkProgress({});
    });
  }
  async function commitBulk() {
    const valid = bulkPreview.filter(
      (x) => x.valid && x.mapping && bulkProgress[x.fileName] !== 100,
    );
    if (!valid.length) return;
    await act(async () => {
      const failed: string[] = [];
      for (const row of valid) {
        const file = bulkFiles.find((f) => f.name === row.fileName);
        if (!file || !row.mapping) continue;
        const body = new FormData();
        body.append("file", file);
        body.append("mapping", JSON.stringify(row.mapping));
        body.append("confirmDuplicateHash", String(duplicateHashAcknowledged));
        body.append("duplicateHashReason", duplicateHashReason);
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/admin/bulk-upload");
            void appCheckHeaders()
              .then((headers) => {
                for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
                xhr.setRequestHeader("x-csrf-token", decodeURIComponent(csrf()));
                xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable)
                    setBulkProgress((v) => ({
                      ...v,
                      [row.fileName]: Math.round((e.loaded / e.total) * 100),
                    }));
                };
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    setBulkProgress((v) => ({ ...v, [row.fileName]: 100 }));
                    resolve();
                  } else {
                    let payload: Record<string, unknown> = {};
                    try {
                      payload = JSON.parse(xhr.responseText) as Record<string, unknown>;
                    } catch {}
                    if (payload.duplicateFileWarning === true)
                      setDuplicateHashWarning(String(payload.error ?? "Duplicate file detected."));
                    reject(
                      new Error(
                        `Upload failed for ${row.fileName}: ${String(payload.error ?? xhr.responseText)}`,
                      ),
                    );
                  }
                };
                xhr.onerror = () => {
                  reject(new Error(`Network error uploading ${row.fileName}`));
                };
                xhr.send(body);
              })
              .catch(reject);
          });
        } catch {
          failed.push(row.fileName);
          setBulkProgress((v) => ({ ...v, [row.fileName]: 0 }));
        }
      }
      if (failed.length) throw new Error(`Retry required for: ${failed.join(", ")}`);
      setBulkPreview([]);
      setBulkFiles([]);
      setBulkCsv(null);
      await load();
    });
  }
  async function downloadTemplate(format: "csv" | "xlsx") {
    await act(async () => {
      const response = await fetch(`/api/admin/templates?format=${format}`, {
        headers: await appCheckHeaders(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Template download failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `student-import-template.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  return {
    csv,
    setCsv,
    preview,
    setPreview,
    bulkFiles,
    setBulkFiles,
    bulkCsv,
    setBulkCsv,
    bulkPreview,
    setBulkPreview,
    bulkProgress,
    setBulkProgress,
    importCsv,
    previewBulk,
    commitBulk,
    downloadTemplate,
  };
}
