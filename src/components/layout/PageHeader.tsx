import type { ReactNode } from "react";
export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        )}
      </div>
      {actions}
    </header>
  );
}
