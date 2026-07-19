"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AIRPORTS,
  Airport,
  findAirportByIata,
  formatAirportLabel,
} from "@/lib/airports";
import { cn } from "@/lib/utils";

type AirportComboboxProps = {
  valueIata: string;
  onChange: (airport: Airport | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  airports?: Airport[];
  "aria-label"?: string;
};

export function AirportCombobox({
  valueIata,
  onChange,
  placeholder = "city or airport",
  disabled,
  className,
  inputClassName,
  airports,
  "aria-label": ariaLabel,
}: AirportComboboxProps) {
  const catalog = airports ?? AIRPORTS;
  const selected = findAirportByIata(valueIata);
  const [query, setQuery] = useState(
    selected ? formatAirportLabel(selected) : valueIata,
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const next = findAirportByIata(valueIata);
    setQuery(next ? formatAirportLabel(next) : valueIata);
  }, [valueIata]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const options = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 12);
    return catalog
      .map((airport) => {
        const hay =
          `${airport.city} ${airport.iata} ${airport.country} ${airport.name}`.toLowerCase();
        let score = 0;
        if (airport.iata.toLowerCase() === q) score += 100;
        if (airport.city.toLowerCase() === q) score += 80;
        if (airport.city.toLowerCase().startsWith(q)) score += 50;
        if (airport.iata.toLowerCase().startsWith(q)) score += 40;
        if (hay.includes(q)) score += 10;
        return { airport, score };
      })
      .filter((row) => row.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.airport.city.localeCompare(b.airport.city),
      )
      .slice(0, 12)
      .map((row) => row.airport);
  })();

  function pick(airport: Airport) {
    onChange(airport);
    setQuery(formatAirportLabel(airport));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (!next.trim()) {
            onChange(null);
            return;
          }
          const match = options[0];
          if (
            match &&
            (match.iata.toLowerCase() === next.trim().toLowerCase() ||
              formatAirportLabel(match).toLowerCase() ===
                next.trim().toLowerCase())
          ) {
            onChange(match);
          }
        }}
        className={cn(
          "h-11 w-full rounded-xl border-0 bg-transparent px-0 text-sm outline-none",
          inputClassName,
        )}
      />
      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-56 w-full min-w-[16rem] overflow-auto rounded-xl border border-white/15 bg-[#071428] py-1 shadow-xl"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ss-muted lowercase">
              no matching city or airport
            </li>
          ) : (
            options.map((airport) => (
              <li key={airport.iata}>
                <button
                  type="button"
                  role="option"
                  aria-selected={airport.iata === valueIata}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm lowercase hover:bg-white/10"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(airport)}
                >
                  <span className="text-ss-text">
                    {airport.city}{" "}
                    <span className="text-ss-muted">({airport.iata})</span>
                  </span>
                  <span className="text-xs text-ss-muted">
                    {airport.name} · {airport.country}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
