"use client";
import { useEffect } from "react";
export default function useInactivityTimer(onIdle: () => void, timeoutMs: number) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onIdle, timeoutMs);
    };
    const events = ["pointerdown", "keydown", "touchstart", "mousemove"];
    for (const event of events) window.addEventListener(event, reset, { passive: true });
    reset();
    return () => {
      clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, reset);
    };
  }, [onIdle, timeoutMs]);
}
