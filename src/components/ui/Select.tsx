import type { SelectHTMLAttributes } from "react";
export default function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      translate="no"
      {...props}
      className={`min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base outline-none focus:border-[var(--primary)] ${props.className ?? ""}`}
    />
  );
}
