import { Prisma } from '@prisma/client';

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toMonthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function monthsBetweenInclusive(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) +
    1
  );
}

export type OfferPriceRow = {
  priceAmount: Prisma.Decimal | null;
  currency: string | null;
};

export function tripSelectedSpend(trip: {
  flightOfferSnapshots: OfferPriceRow[];
  hotelOfferSnapshots: OfferPriceRow[];
}): { amount: number; currencies: string[] } {
  let amount = 0;
  const currencies: string[] = [];
  for (const offer of [
    ...trip.flightOfferSnapshots,
    ...trip.hotelOfferSnapshots,
  ]) {
    const value = decimalToNumber(offer.priceAmount);
    if (value === null) continue;
    amount += value;
    currencies.push(offer.currency?.trim() || 'EUR');
  }
  return { amount: roundMoney(amount), currencies };
}

export function pickMajorityCurrency(currencies: string[]): string {
  const counts = new Map<string, number>();
  for (const code of currencies) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let currency = 'EUR';
  let maxCount = 0;
  for (const [code, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      currency = code;
    }
  }
  return currency;
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const lines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
