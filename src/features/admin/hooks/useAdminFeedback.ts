import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import { toast } from "@/components/ui/toast";

export function useAdminFeedback() {
  const [busy, setBusy] = useState(false);
  const setToast = useCallback<Dispatch<SetStateAction<string>>>((value) => {
    const message = typeof value === "function" ? value("") : value;
    if (message) toast.add({ type: "success", title: message });
  }, []);
  const setError = useCallback<Dispatch<SetStateAction<string>>>((value) => {
    const message = typeof value === "function" ? value("") : value;
    if (message) toast.add({ type: "error", title: "Admin request failed", description: message });
  }, []);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await toast.promise(fn(), {
        loading: { type: "loading", title: "Saving changes" },
        success: { type: "success", title: "Changes saved" },
        error: (cause) => ({
          type: "error",
          title: "Admin request failed",
          description: cause instanceof Error ? cause.message : "Action failed.",
        }),
      }).catch(() => {
        // The toast manager has already reported the failure.
      });
    } finally {
      setBusy(false);
    }
  }

  return { busy, setBusy, toast: "", setToast, error: "", setError, act };
}
