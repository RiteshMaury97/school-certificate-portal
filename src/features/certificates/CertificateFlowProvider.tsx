"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { StudentResult } from "@/types";

type CertificateFlow = {
  result: StudentResult | null;
  setResult: (result: StudentResult | null) => void;
};

const CertificateFlowContext = createContext<CertificateFlow | null>(null);

/**
 * Holds the verified lookup result while the visitor moves between the finder,
 * results and print pages. It lives only in memory: the result (which carries a
 * short-lived access token) is never placed in the URL or in browser storage,
 * and it is discarded as soon as the visitor leaves `/certificates`.
 */
export default function CertificateFlowProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<StudentResult | null>(null);
  const value = useMemo(() => ({ result, setResult }), [result]);
  return (
    <CertificateFlowContext.Provider value={value}>{children}</CertificateFlowContext.Provider>
  );
}

export function useCertificateFlow(): CertificateFlow {
  const value = useContext(CertificateFlowContext);
  if (!value) throw new Error("useCertificateFlow must be used within CertificateFlowProvider");
  return value;
}
