"use client";
import { useState, type FormEvent } from "react";
export default function VerifyForm({ onSubmit }: { onSubmit: (number: string) => void }) {
  const [number, setNumber] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(number.trim());
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <input
        translate="no"
        required
        maxLength={80}
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="Certificate number"
        className="min-h-11 min-w-0 flex-1 rounded-lg border px-3"
      />
      <button className="min-h-11 rounded-lg bg-[var(--primary)] px-5 font-semibold text-[var(--primary-contrast)]">
        Verify certificate
      </button>
    </form>
  );
}
