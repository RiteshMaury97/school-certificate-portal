"use client";
import { Link, useLocation } from "react-router-dom";

export default function PublicServiceTabs() {
  const location = useLocation();
  const verify = location.pathname === "/verify";
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#263746]";
  return (
    <nav
      aria-label="Certificate services"
      className="mb-6 flex flex-wrap gap-2 rounded-xl border border-[#dfe3e7] bg-white p-2"
    >
      <Link
        to="/"
        aria-current={!verify ? "page" : undefined}
        className={`${base} ${!verify ? "bg-[#263746] text-white" : "text-[#35414c] hover:bg-[#f1f3f5]"}`}
      >
        Find My Certificates
      </Link>
      <Link
        to="/verify"
        aria-current={verify ? "page" : undefined}
        className={`${base} ${verify ? "bg-[#263746] text-white" : "text-[#35414c] hover:bg-[#f1f3f5]"}`}
      >
        Verify a Certificate
      </Link>
    </nav>
  );
}
