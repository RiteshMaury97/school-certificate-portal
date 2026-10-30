import type { InputHTMLAttributes } from "react";
export default function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      translate="no"
      {...props}
      className={`min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus)]/20 ${props.className ?? ""}`}
    />
  );
}
