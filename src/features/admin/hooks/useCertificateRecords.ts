import { useState } from "react";

import type { CertificateHistory } from "../types/admin-state.types";
import type { Cert } from "../types/admin.types";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;

export function useCertificateRecords(api: Api, act: (fn: () => Promise<void>) => Promise<void>) {
  const [certs, setCerts] = useState<Cert[]>([]);
  const [certificateHistory, setCertificateHistory] = useState<CertificateHistory>({});

  async function loadCertificateHistory(id: string) {
    await act(async () => {
      const d = await api<{ events: Record<string, unknown>[] }>(
        `/api/admin/certificates/${id}/history`,
      );
      setCertificateHistory((v) => ({ ...v, [id]: d.events ?? [] }));
    });
  }

  return { certs, setCerts, certificateHistory, setCertificateHistory, loadCertificateHistory };
}
