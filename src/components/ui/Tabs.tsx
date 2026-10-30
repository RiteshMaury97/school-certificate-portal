export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${active === tab.id ? "bg-[var(--primary)] text-[var(--primary-contrast)]" : "bg-slate-100 text-slate-700"}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
