"use client";
import { Link } from "react-router-dom";
export default function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-0 z-50 bg-black/40 md:hidden"
      onClick={onClose}
    >
      <div
        className="ml-auto flex h-dvh w-[min(86vw,22rem)] flex-col gap-2 bg-white p-6"
        onClick={(event) => { event.stopPropagation(); }}
      >
        <button className="min-h-11 self-end" aria-label="Close menu" onClick={onClose}>
          ✕
        </button>
        {[
          ["Home", "/"],
          ["Certificates", "/certificates"],
          ["Verify", "/verify"],
          ["FAQ", "/faq"],
          ["Contact", "/contact"],
        ].map(([label, path]) => (
          <Link
            key={path}
            onClick={onClose}
            className="flex min-h-11 items-center rounded-lg px-3 hover:bg-slate-100"
            to={path}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
