import { useState } from "react";

export function useAdminFeedback() {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setToast("Changes saved successfully.");
      setTimeout(() => { setToast(""); }, 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return { busy, setBusy, toast, setToast, error, setError, act };
}
