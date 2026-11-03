"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type DatePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  includeTime?: boolean;
  placeholder?: string;
};

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const weekDays = Array.from({ length: 7 }, (_, index) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(2024, 0, 7 + index)),
);

function parseValue(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "00:00" };
  const [date = "", time = "00:00"] = value.split("T");
  return { date, time: time.slice(0, 5) || "00:00" };
}

function dateFromKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function keyFromDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  className = "",
  required = false,
  disabled = false,
  min,
  max,
  includeTime = false,
  placeholder,
}: DatePickerProps) {
  const { date: selectedDate, time } = parseValue(value);
  const parsedSelected = dateFromKey(selectedDate);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const current = parsedSelected ?? new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogId = `${id}-calendar`;
  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const offset = first.getDay();
    return Array.from({ length: 42 }, (_, index) =>
      new Date(first.getFullYear(), first.getMonth(), index - offset + 1),
    );
  }, [visibleMonth]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function chooseDay(day: Date) {
    const key = keyFromDate(day);
    onChange(includeTime ? `${key}T${time}` : key);
    if (!includeTime) setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-required={required || undefined}
        data-empty={!selectedDate}
        onClick={() => {
          if (parsedSelected)
            setVisibleMonth(new Date(parsedSelected.getFullYear(), parsedSelected.getMonth(), 1));
          setOpen((current) => !current);
        }}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 text-left text-sm text-[var(--text)] shadow-sm outline-none transition hover:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 disabled:cursor-not-allowed disabled:opacity-50 data-[empty=true]:text-[var(--text-muted)]"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <CalendarDays size={16} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="truncate">
            {parsedSelected ? dateFormat.format(parsedSelected) : (placeholder ?? "Pick a date")}
            {includeTime && selectedDate && <span className="ml-2 text-[var(--text-muted)]">{time}</span>}
          </span>
        </span>
        {includeTime && <Clock3 size={15} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />}
      </button>

      <input
        aria-hidden="true"
        tabIndex={-1}
        required={required} aria-required={required}
        value={selectedDate ? (includeTime ? `${selectedDate}T${time}` : selectedDate) : ""}
        onChange={() => undefined}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={`${label} calendar`}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-3 text-[var(--text)] shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="grid size-8 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <div aria-live="polite" className="text-sm font-semibold">
              {monthFormat.format(visibleMonth)}
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="grid size-8 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div role="grid" aria-label={monthFormat.format(visibleMonth)} className="grid grid-cols-7 gap-1 text-center">
            {weekDays.map((day, index) => (
              <div key={`${day}-${index}`} role="columnheader" className="py-1 text-[10px] font-medium text-[var(--text-muted)]">
                {day}
              </div>
            ))}
            {days.map((day) => {
              const key = keyFromDate(day);
              const outsideMonth = day.getMonth() !== visibleMonth.getMonth();
              const isSelected = key === selectedDate;
              const unavailable = (min && key < min) || (max && key > max);
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  aria-label={dateFormat.format(day)}
                  aria-selected={isSelected}
                  disabled={Boolean(unavailable)}
                  onClick={() => chooseDay(day)}
                  className={`mx-auto grid size-9 place-items-center rounded-lg text-xs outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                    isSelected
                      ? "bg-[var(--primary)] font-semibold text-[var(--on-primary)]"
                      : outsideMonth
                        ? "text-[var(--text-muted)]/55 hover:bg-[var(--surface-2)]"
                        : "hover:bg-[var(--surface-2)]"
                  } disabled:pointer-events-none disabled:opacity-30`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          {includeTime && (
            <label className="mt-3 flex items-center justify-between border-t border-[var(--divider)] pt-3 text-xs font-medium text-[var(--text-muted)]">
              Time
              <input
                aria-label={`${label} time`}
                type="time"
                value={time}
                onChange={(event) => {
                  if (selectedDate) onChange(`${selectedDate}T${event.target.value}`);
                  else onChange(`${keyFromDate(new Date())}T${event.target.value}`);
                }}
                className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              />
            </label>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-[var(--divider)] pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                if (!includeTime) setOpen(false);
              }}
              className="rounded-md px-2 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              Clear
            </button>
            {includeTime && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--on-primary)] hover:opacity-90"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
