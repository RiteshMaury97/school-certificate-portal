"use client";
import { useState } from "react";
import { appCheckHeaders } from "@/src/lib/firebase-client";
export function useCertificateSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function search(payload: unknown) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/certificates/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error("No data found");
      return data;
    } catch {
      setError("No data found");
      return null;
    } finally {
      setLoading(false);
    }
  }
  return { search, loading, error };
}
