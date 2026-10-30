"use client";
import { useEffect } from "react";
export default function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Satyam International School`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
