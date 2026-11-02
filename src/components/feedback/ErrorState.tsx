"use client";

import { useEffect } from "react";

import { toast } from "@/components/ui/toast";

export default function ErrorState({
  title = "Unable to load this information",
  description = "A connection or service error occurred. Please try again.",
  onRetry,
  retryLabel = "Retry",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  useEffect(() => {
    toast.add({
      type: "error",
      title,
      description,
      ...(onRetry ? { actionProps: { children: retryLabel, onClick: onRetry } } : {}),
    });
  }, [description, onRetry, retryLabel, title]);
  return null;
}
