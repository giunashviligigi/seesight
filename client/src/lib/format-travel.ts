export function formatDuration(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null || !Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return "—";
  }
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatFlightDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFlightClock(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Whole nights between ISO dates (check-out exclusive). Minimum 1. */
export function nightsBetween(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): number | null {
  if (!checkIn || !checkOut) return null;
  const start = Date.parse(`${checkIn}T00:00:00.000Z`);
  const end = Date.parse(`${checkOut}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export function formatNights(nights: number | null | undefined): string {
  if (nights == null || !Number.isFinite(nights) || nights < 1) return "";
  const n = Math.round(nights);
  return n === 1 ? "1 night" : `${n} nights`;
}

export function formatHotelStayPrice(opts: {
  priceAmount: number | null | undefined;
  currency: string | null | undefined;
  checkIn?: string | null;
  checkOut?: string | null;
  nights?: number | null;
  pricePerNight?: number | null;
}): string {
  const nights =
    opts.nights ?? nightsBetween(opts.checkIn, opts.checkOut) ?? null;
  const nightsLabel = formatNights(nights);
  if (opts.priceAmount == null) {
    return nightsLabel || "price n/a";
  }
  const currency = opts.currency ?? "EUR";
  const total = `${opts.priceAmount} ${currency}`;
  if (!nightsLabel) return `${total} total`;
  const perNight =
    opts.pricePerNight != null
      ? opts.pricePerNight
      : nights && nights > 0
        ? Math.round((opts.priceAmount / nights) * 100) / 100
        : null;
  if (perNight == null) return `${total} · ${nightsLabel}`;
  return `${total} total · ${nightsLabel} · ~${perNight} ${currency}/night`;
}
