"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
  min?: string;
  max?: string;
  "aria-label"?: string;
};

const WEEKDAYS = ["su", "mo", "tu", "we", "th", "fr", "sa"];

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, delta: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1),
  );
}

function formatDisplay(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return "pick a date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const fieldClassName =
  "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-white/20 bg-ss-surface-strong px-3 text-sm text-ss-text lowercase outline-none transition-colors hover:border-white/35 focus-visible:border-ss-accent focus-visible:ring-2 focus-visible:ring-ss-accent/40 disabled:cursor-not-allowed disabled:opacity-50";

export function DateInput({
  value,
  onChange,
  disabled,
  required,
  className,
  triggerClassName,
  id,
  min,
  max,
  "aria-label": ariaLabel,
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const [viewMonth, setViewMonth] = useState<Date>(
    () => startOfMonth(selected ?? new Date()),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const minDate = min ? parseIsoDate(min) : null;
  const maxDate = max ? parseIsoDate(max) : null;

  useEffect(() => {
    if (selected) setViewMonth(startOfMonth(selected));
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const days = useMemo(() => {
    const first = startOfMonth(viewMonth);
    const startWeekday = first.getUTCDay();
    const gridStart = new Date(first);
    gridStart.setUTCDate(first.getUTCDate() - startWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setUTCDate(gridStart.getUTCDate() + index);
      return day;
    });
  }, [viewMonth]);

  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(viewMonth);

  function isDisabled(day: Date): boolean {
    if (minDate && day.getTime() < minDate.getTime()) return true;
    if (maxDate && day.getTime() > maxDate.getTime()) return true;
    return false;
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input
        type="text"
        tabIndex={-1}
        aria-hidden
        required={required}
        value={value}
        onChange={() => undefined}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-required={required}
        className={cn(fieldClassName, triggerClassName)}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={cn("truncate", !selected && "text-ss-muted")}>
          {formatDisplay(value)}
        </span>
        <CalendarDays className="size-4 shrink-0 text-ss-muted" aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="choose date"
          className="absolute z-50 mt-2 w-[18.5rem] rounded-2xl border border-white/15 bg-[#071428] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-lg text-ss-muted transition-colors hover:bg-white/10 hover:text-ss-text"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              aria-label="previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-medium lowercase text-ss-text">
              {monthLabel}
            </p>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-lg text-ss-muted transition-colors hover:bg-white/10 hover:text-ss-text"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                className="py-1 text-center text-[0.65rem] uppercase tracking-wide text-ss-muted"
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const iso = toIsoDate(day);
              const inMonth = day.getUTCMonth() === viewMonth.getUTCMonth();
              const isSelected = selected ? toIsoDate(selected) === iso : false;
              const disabledDay = isDisabled(day);

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabledDay}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-lg text-sm transition-colors",
                    !inMonth && "text-ss-muted/40",
                    inMonth && !isSelected && "text-ss-text hover:bg-white/10",
                    isSelected && "bg-ss-accent text-white hover:bg-ss-accent-hover",
                    disabledDay && "cursor-not-allowed opacity-30 hover:bg-transparent",
                  )}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {day.getUTCDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs lowercase text-ss-muted hover:text-ss-text"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              clear
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-xs lowercase text-ss-muted hover:text-ss-text"
              onClick={() => {
                const today = toIsoDate(new Date());
                onChange(today);
                setViewMonth(startOfMonth(new Date()));
                setOpen(false);
              }}
            >
              today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
