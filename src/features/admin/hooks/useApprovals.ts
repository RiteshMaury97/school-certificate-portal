import { useState, type Dispatch, type SetStateAction } from "react";

import type { CertificatePreviewMap } from "../types/admin-state.types";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type Props = {
  api: Api;
  act: (fn: () => Promise<void>) => Promise<void>;
  setError: Dispatch<SetStateAction<string>>;
  load: () => Promise<void>;
};
export function useApprovals({ api, act, setError, load }: Props) {
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [approvalChecks, setApprovalChecks] = useState<Record<string, boolean>>({});
  const [previewUrls, setPreviewUrls] = useState<CertificatePreviewMap>({});
  async function decideCertificate(id: string, decision: "approve" | "reject") {
    const reason = rejectReason[id] ?? "";
    if (decision === "reject" && !reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    if (decision === "approve" && !approvalChecks[id]) {
      setError("Confirm that the student details match the document before approval.");
      return;
    }
    await act(async () => {
      await api(`/api/admin/certificates/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reason,
          detailsMatch: approvalChecks[id] === true,
        }),
      });
      setApprovalChecks((v) => ({ ...v, [id]: false }));
      await load();
    });
  }
  async function loadPreview(id: string) {
    await act(async () => {
      const d = await api<{ url: string; mimeType: string }>(
        `/api/admin/certificates/${id}/preview`,
      );
      setPreviewUrls((v) => ({
        ...v,
        [id]: { url: d.url, mimeType: d.mimeType },
      }));
    });
  }
  return {
    rejectReason,
    setRejectReason,
    approvalChecks,
    setApprovalChecks,
    previewUrls,
    setPreviewUrls,
    decideCertificate,
    loadPreview,
  };
}
