import type { InputHTMLAttributes } from "react";
export default function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      translate="no"
      {...props}
      type="checkbox"
      className={`h-5 w-5 rounded border-slate-300 accent-[var(--primary)] ${props.className ?? ""}`}
    />
  );
}
