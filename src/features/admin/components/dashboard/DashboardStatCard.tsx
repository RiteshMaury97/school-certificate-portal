import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Clock3,
  Heart,
  LifeBuoy,
  Search,
  Users,
} from "lucide-react";

const icons = {
  users: Users,
  certificate: Award,
  pending: Clock3,
  search: Search,
  alert: AlertTriangle,
  check: BadgeCheck,
  support: LifeBuoy,
  heart: Heart,
} as const;

const tones = {
  green: "bg-emerald-100 text-emerald-800",
  blue: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-800",
  purple: "bg-violet-100 text-violet-800",
  red: "bg-rose-100 text-rose-800",
} as const;

type Props = {
  label: string;
  value: unknown;
  detail: string;
  tone: keyof typeof tones;
  icon: keyof typeof icons;
};

export default function DashboardStatCard({ label, value, detail, tone, icon }: Props) {
  const Icon = icons[icon];
  const displayValue = typeof value === "number" || typeof value === "string" ? String(value) : "0";
  return (
    <article className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className={`grid h-9 w-9 place-items-center rounded-full ${tones[tone]}`}><Icon size={16} aria-hidden="true" /></span>
        <span className="text-right text-[10px] text-[var(--text-muted)]">{detail}</span>
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--text)]">{displayValue}</p>
    </article>
  );
}
