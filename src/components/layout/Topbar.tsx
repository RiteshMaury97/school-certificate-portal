"use client";
export default function Topbar({ title }: { title: string }) {
  return (
    <header className="flex min-h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-5">
      <h1 className="font-semibold text-[var(--text)]">{title}</h1>
      <a href="/" className="text-sm font-medium text-[var(--primary)]">
        View school site
      </a>
    </header>
  );
}
