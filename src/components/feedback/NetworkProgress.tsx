"use client";
import { useEffect, useState } from "react";

/** The admin session heartbeat polls in the background; it must not flash the bar. */
const QUIET_PATHS = new Set(["/api/admin/session"]);

function describe(input: RequestInfo | URL, init?: RequestInit) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = (
    init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")
  ).toUpperCase();
  let path = "";
  try {
    path = new URL(raw, window.location.origin).pathname;
  } catch {
    path = "";
  }
  return { method, path };
}

/**
 * A thin animated bar at the top of the window that stays visible for as long
 * as any request to the backend is in flight. It wraps `fetch` once, so every
 * form, table and page gets loading feedback without per-component code.
 */
export default function NetworkProgress() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const original = window.fetch.bind(window);
    let pending = 0;
    let timer: number | undefined;
    const start = () => {
      pending += 1;
      // Short requests finish before the bar appears, so it never flickers.
      if (pending === 1)
        timer = window.setTimeout(() => {
          setActive(true);
        }, 140);
    };
    const finish = () => {
      pending = Math.max(0, pending - 1);
      if (pending === 0) {
        window.clearTimeout(timer);
        setActive(false);
      }
    };
    window.fetch = async (input, init) => {
      const { method, path } = describe(input, init);
      if (method === "GET" && QUIET_PATHS.has(path)) return original(input, init);
      start();
      try {
        return await original(input, init);
      } finally {
        finish();
      }
    };
    return () => {
      window.fetch = original;
      window.clearTimeout(timer);
    };
  }, []);

  return <div className="top-progress" aria-hidden="true" data-active={active} />;
}
